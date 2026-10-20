const BUCKET='project-files';
const PDFJS_VERSION='4.10.38';
const PROPERTY_TYPES=['Lote','Casa','Departamento'];
const PROPERTY_STATUS={
 available:{label:'Disponible',color:'#34C759'},
 reserved:{label:'Reservado',color:'#FFCC00'},
 sold:{label:'Vendido',color:'#FF3B30'},
 blocked:{label:'Bloqueado',color:'#8E44AD'},
 unknown:{label:'Por confirmar',color:'#8E8E93'}
};
const attr=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const slug=value=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'')||'plano';
const numberValue=value=>value===''||value==null?null:Number(value);
export function parseDxf(source){
 const rows=source.replace(/\r/g,'').split('\n');
 const pairs=[];
 for(let i=0;i+1<rows.length;i+=2){
  const code=Number(rows[i].trim()),value=rows[i+1].trim();
  if(Number.isFinite(code))pairs.push([code,value]);
 }
 const sectionIndex=pairs.findIndex(([code,value])=>code===2&&value==='ENTITIES');
 if(sectionIndex<0)throw new Error('El DXF no contiene una sección ENTITIES que se pueda leer.');
 let end=sectionIndex+1;
 while(end<pairs.length&&!(pairs[end][0]===0&&pairs[end][1]==='ENDSEC'))end++;
 const entities=[];
 for(let i=sectionIndex+1;i<end;){
  if(pairs[i][0]!==0){i++;continue}
  const kind=pairs[i][1],data=[];
  i++;
  while(i<end&&pairs[i][0]!==0)data.push(pairs[i++]);
  if(kind==='LWPOLYLINE'){
   const points=[];
   for(let j=0;j<data.length;j++){
    if(data[j][0]===10){
     const y=data.slice(j+1).find(([code])=>code===20)?.[1];
     if(y!==undefined)points.push([Number(data[j][1]),Number(y)]);
    }
   }
   if(points.length>1)entities.push({type:'polyline',points,closed:(Number(data.find(([code])=>code===70)?.[1]||0)&1)===1});
  }else if(kind==='POLYLINE'){
   const points=[];
   let closed=(Number(data.find(([code])=>code===70)?.[1]||0)&1)===1;
   while(i<end&&pairs[i][0]===0&&pairs[i][1]==='VERTEX'){
    i++;
    const vertex=[];
    while(i<end&&pairs[i][0]!==0)vertex.push(pairs[i++]);
    const x=vertex.find(([code])=>code===10)?.[1],y=vertex.find(([code])=>code===20)?.[1];
    if(x!==undefined&&y!==undefined)points.push([Number(x),Number(y)]);
   }
   if(i<end&&pairs[i][0]===0&&pairs[i][1]==='SEQEND')i++;
   if(points.length>1)entities.push({type:'polyline',points,closed});
  }else if(kind==='LINE'){
   const x1=data.find(([code])=>code===10)?.[1],y1=data.find(([code])=>code===20)?.[1];
   const x2=data.find(([code])=>code===11)?.[1],y2=data.find(([code])=>code===21)?.[1];
   if([x1,y1,x2,y2].every(value=>value!==undefined))entities.push({type:'line',points:[[Number(x1),Number(y1)],[Number(x2),Number(y2)]],closed:false});
  }else if(kind==='CIRCLE'){
   const x=data.find(([code])=>code===10)?.[1],y=data.find(([code])=>code===20)?.[1],r=data.find(([code])=>code===40)?.[1];
   if([x,y,r].every(value=>value!==undefined))entities.push({type:'circle',center:[Number(x),Number(y)],radius:Number(r)});
  }
 }
 const coordinates=entities.flatMap(entity=>entity.type==='circle'?[
  [entity.center[0]-entity.radius,entity.center[1]-entity.radius],
  [entity.center[0]+entity.radius,entity.center[1]+entity.radius]
 ]:entity.points);
 if(!coordinates.length)throw new Error('No se encontraron contornos, líneas o círculos compatibles en el DXF.');
 const minX=Math.min(...coordinates.map(point=>point[0])),maxX=Math.max(...coordinates.map(point=>point[0]));
 const minY=Math.min(...coordinates.map(point=>point[1])),maxY=Math.max(...coordinates.map(point=>point[1]));
 const width=maxX-minX||1,height=maxY-minY||1;
 const mapPoint=([x,y])=>[x-minX,maxY-y];
 const paths=[],polygons=[];
 entities.forEach(entity=>{
  if(entity.type==='circle'){
   const [x,y]=mapPoint(entity.center);
   paths.push(`<circle cx="${x}" cy="${y}" r="${entity.radius}" />`);
   return;
  }
  const points=entity.points.map(mapPoint);
  const d=points.map(([x,y],index)=>`${index?'L':'M'}${x} ${y}`).join(' ')+(entity.closed?' Z':'');
  paths.push(`<path d="${d}" />`);
  if(entity.closed&&points.length>=3)polygons.push(points);
 });
 return{width,height,paths:paths.join(''),polygons};
}

export function parsePdfLotLabels(textContent,viewport,transformPoint){
 const lots=[];
 const areas=[];
 for(const item of textContent.items||[]){
  const text=String(item.str||'').trim();
  const lotMatch=text.match(/^LOTE\s+(\d+)$/i);
  const areaMatch=text.match(/^(AREA(?:\s+\(([^)]+)\))?)\s*:\s*([\d.,]+)\s*m(?:2|²)$/i);
  if(!lotMatch&&!areaMatch)continue;
  const transform=transformPoint(viewport.transform,item.transform);
  const width=Math.hypot(transform[0],transform[1]);
  const height=Math.hypot(transform[2],transform[3]);
  const corners=[
   [transform[4],transform[5]],
   [transform[4]+transform[0],transform[5]+transform[1]],
   [transform[4]+transform[2],transform[5]+transform[3]],
   [transform[4]+transform[0]+transform[2],transform[5]+transform[1]+transform[3]]
  ];
  const bounds={
   left:Math.min(...corners.map(point=>point[0])),
   right:Math.max(...corners.map(point=>point[0])),
   top:Math.min(...corners.map(point=>point[1])),
   bottom:Math.max(...corners.map(point=>point[1]))
  };
  const position={x:(bounds.left+bounds.right)/2,y:(bounds.top+bounds.bottom)/2};
  if(lotMatch)lots.push({number:Number(lotMatch[1]),code:`LOTE ${Number(lotMatch[1])}`,...position,width:Math.max(width,height),height:Math.min(width,height),areas:[]});
  if(areaMatch){
   const area=Number(areaMatch[3].replace(',','.'));
   if(Number.isFinite(area))areas.push({text,qualifier:areaMatch[2]||'',area,...position});
  }
 }
 for(const area of areas){
  const nearest=lots.map(lot=>({lot,distance:Math.hypot(lot.x-area.x,lot.y-area.y)})).sort((a,b)=>a.distance-b.distance)[0];
  if(nearest&&nearest.distance<=80)nearest.lot.areas.push(area);
 }
 return lots.sort((a,b)=>a.number-b.number).map(lot=>{
  const uniqueAreas=[...new Map(lot.areas.map(area=>[`${area.qualifier.toLocaleLowerCase('es')}:${area.area}`,area])).values()];
  const clearOfficialArea=uniqueAreas.length===1&&!uniqueAreas[0].qualifier?uniqueAreas[0].area:null;
  const observations=uniqueAreas.length>1
   ?`El plano consigna áreas distintas: ${uniqueAreas.map(area=>`${area.qualifier||'sin calificar'} ${area.area} m²`).join('; ')}. Verificar antes de registrar el área oficial.`
   :uniqueAreas.length===1&&uniqueAreas[0].qualifier
    ?`Área consignada en el plano (${uniqueAreas[0].qualifier}): ${uniqueAreas[0].area} m². Confirmar si corresponde al área oficial.`
    :'';
  return{...lot,area:clearOfficialArea,observations};
 });
}

function propertyColor(status){return PROPERTY_STATUS[status]?.color||'#34C759'}
function defaultType(project){
 if(project.project_type==='Lotes'||project.t==='Lotes')return'Lote';
 if(project.project_type==='Departamentos'||project.t==='Departamentos')return'Departamento';
 return'Casa';
}
function emptyProperty(project,plan,sequence=1){
 return{id:null,project_id:project.id,plan_id:plan.id,property_type:defaultType(project),code:`${defaultType(project)} ${sequence}`,block:'',address:'',location_label:'',building:'',tower:'',floor_label:plan.floor_label||'',area_land_m2:null,area_total_m2:null,area_covered_m2:null,other_areas_m2:null,frontage_m:null,back_m:null,side_a_m:null,side_b_m:null,floors:null,bedrooms:null,bathrooms:null,status:'unknown',price:null,observations:'',geometry:{type:'Polygon',coordinates:[]}};
}

export function createPlanWorkspace({getSupabase,getIsAdmin,getUser,getProjects,onSelectProject}){
 const root=document.createElement('section');
 root.id='plans-workspace';
 root.setAttribute('aria-label','Planos interactivos');
 root.innerHTML=`<header class="plans-header"><div><strong>Planos interactivos</strong><span>Selecciona una propiedad o administra su plano</span></div><button type="button" data-action="close">Volver al mapa</button></header>
 <div class="plans-toolbar"><label>Proyecto<select data-field="project"></select></label><label>Plano<select data-field="plan"></select></label><button type="button" data-action="zoom-out" aria-label="Reducir zoom">−</button><input data-field="zoom" type="range" min="0.5" max="4" step="0.1" value="1" aria-label="Zoom del plano"><button type="button" data-action="zoom-in" aria-label="Aumentar zoom">+</button><span data-role="zoom-label">100%</span></div>
 <div class="plans-layout"><aside class="plans-sidebar"><div class="plans-search"><label>Buscar propiedad<input data-field="search" type="search" placeholder="Código, manzana, torre, piso…"></label><label>Estado<select data-field="status-filter"><option value="">Todos los estados</option><option value="available">Disponible</option><option value="reserved">Reservado</option><option value="sold">Vendido</option><option value="blocked">Bloqueado</option><option value="unknown">Por confirmar</option></select></label></div><div class="plans-list" data-role="property-list"></div><div class="plans-admin-tools" data-role="admin-tools"></div></aside><div class="plans-stage"><div class="plans-stage-message" data-role="stage-message">Selecciona un proyecto y plano para comenzar.</div><div class="plans-pan" data-role="pan"><div class="plans-surface" data-role="surface"><canvas data-role="pdf-canvas"></canvas><svg data-role="plan-svg" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Plano interactivo"></svg></div></div><div class="plans-draw-tools" data-role="draw-tools"></div></div><aside class="plans-inspector" data-role="inspector"><h2>Ficha de propiedad</h2><p>Elige una figura del plano para consultar sus datos.</p></aside></div><p class="plans-status" role="status" aria-live="polite"></p>`;
 document.body.append(root);

 const $=selector=>root.querySelector(selector);
 const state={open:false,projectId:'',planId:'',selectedPlanByProject:new Map(),projectLoadSequence:0,plans:[],units:[],selectedId:'',draft:null,scene:null,drawing:false,drawPoints:[],zoom:1,panX:0,panY:0,drag:null,loadingPlan:false,refreshTimer:null,pdfDocument:null};
 const statusMessage=text=>{$('.plans-status').textContent=text||''};
 const planById=()=>state.plans.find(plan=>plan.id===state.planId)||null;
 const projectById=()=>getProjects().find(project=>project.id===state.projectId)||null;
 const selectedUnit=()=>state.units.find(unit=>unit.id===state.selectedId)||null;
 const publicPlanUrl=plan=>getSupabase().storage.from(BUCKET).getPublicUrl(plan.file_path).data.publicUrl;
 const formatPrice=price=>price==null?'Consultar':`S/ ${Number(price).toLocaleString('es-PE')}`;

 function initializeSelectors(){
  const projectSelect=$('[data-field="project"]');
  projectSelect.innerHTML=getProjects().filter(project=>['Lotes','Departamentos','Casas','Casa de campo'].includes(project.t)).map(project=>`<option value="${attr(project.id)}">${attr(project.n)}</option>`).join('');
  state.projectId=projectSelect.value||'';
  projectSelect.onchange=()=>{
   if(state.projectId&&state.planId)state.selectedPlanByProject.set(state.projectId,state.planId);
   state.projectId=projectSelect.value;
   state.planId=state.selectedPlanByProject.get(state.projectId)||'';
   state.selectedId='';state.draft=null;state.scene=null;
   loadProjectData();
  };
  $('[data-field="plan"]').onchange=()=>{
   state.planId=$('[data-field="plan"]').value;
   if(state.projectId&&state.planId)state.selectedPlanByProject.set(state.projectId,state.planId);
   state.selectedId='';state.draft=null;loadPlanScene();
  };
  $('[data-field="search"]').oninput=renderPropertyList;
  $('[data-field="status-filter"]').onchange=renderPropertyList;
  $('[data-field="zoom"]').oninput=()=>setZoom(Number($('[data-field="zoom"]').value));
  $('[data-action="close"]').onclick=close;
  $('[data-action="zoom-out"]').onclick=()=>setZoom(state.zoom-.2);
  $('[data-action="zoom-in"]').onclick=()=>setZoom(state.zoom+.2);
  $('[data-role="pan"]').addEventListener('wheel',event=>{event.preventDefault();setZoom(state.zoom+(event.deltaY<0?.15:-.15))},{passive:false});
  bindPan();
 }

 async function open(projectId=''){
  if(projectId&&getProjects().some(project=>project.id===projectId)){
   state.projectId=projectId;
   $('[data-field="project"]').value=projectId;
   state.planId=state.selectedPlanByProject.get(projectId)||'';
  }
  state.open=true;
  root.classList.add('open');
  document.body.classList.add('plans-open');
  state.refreshTimer=window.setInterval(()=>{if(state.open)refreshData(true).catch(error=>statusMessage(error.message))},30000);
  await loadProjectData();
 }
 function close(){
  state.open=false;
  root.classList.remove('open');
  document.body.classList.remove('plans-open');
  window.clearInterval(state.refreshTimer);
  state.refreshTimer=null;
 }
 async function refreshData(openChangedPlan=false,expectedProjectId=state.projectId,expectedSequence=state.projectLoadSequence){
  if(!getSupabase())throw new Error('Supabase no está conectado.');
  const previousPlanId=state.planId;
  const [planResult,unitResult]=await Promise.all([
   getSupabase().from('property_plans').select('*').order('name'),
   getSupabase().from('property_units').select('*').order('code')
  ]);
  if(state.projectId!==expectedProjectId||state.projectLoadSequence!==expectedSequence)return;
  if(planResult.error)throw new Error(`No se pudieron cargar los planos. Aplica supabase-plans-migration.sql en Supabase: ${planResult.error.message}`);
  if(unitResult.error)throw new Error(`No se pudieron cargar las propiedades del plano: ${unitResult.error.message}`);
  if(state.projectId!==expectedProjectId||state.projectLoadSequence!==expectedSequence)return;
  state.plans=planResult.data||[];
  state.units=unitResult.data||[];
  renderPlanOptions();
  renderPropertyList();
  renderInspector();
  if(openChangedPlan&&state.planId!==previousPlanId)await loadPlanScene();
 }
 async function loadProjectData(){
  const projectId=state.projectId,sequence=++state.projectLoadSequence;
  $('[data-field="search"]').placeholder=projectId==='joya-verde'?'Código o número de lote':'Código, manzana, torre, piso…';
  statusMessage('');
  $('.plans-stage-message').textContent='Cargando planos del proyecto…';
  $('.plans-stage-message').hidden=false;
  $('.plans-surface').hidden=true;
  try{
   await refreshData(false,projectId,sequence);
   if(state.projectId!==projectId||state.projectLoadSequence!==sequence)return;
   await loadPlanScene();
  }catch(error){
   if(state.projectId!==projectId||state.projectLoadSequence!==sequence)return;
   statusMessage(error.message);$('.plans-stage-message').textContent=error.message
  }
 }
 function renderPlanOptions(){
  const select=$('[data-field="plan"]');
  const projectPlans=state.plans.filter(plan=>plan.project_id===state.projectId);
  select.innerHTML=`<option value="">Selecciona un plano</option>${projectPlans.map(plan=>`<option value="${attr(plan.id)}">${attr(plan.name)}${plan.floor_label?` · ${attr(plan.floor_label)}`:''}</option>`).join('')}`;
  const rememberedPlanId=state.selectedPlanByProject.get(state.projectId);
  const selectedPlan=projectPlans.find(plan=>plan.id===state.planId)
   ||projectPlans.find(plan=>plan.id===rememberedPlanId)
   ||projectPlans[0];
  state.planId=selectedPlan?.id||'';
  select.value=state.planId;
  if(state.planId)state.selectedPlanByProject.set(state.projectId,state.planId);
  if(projectPlans.length===0)statusMessage('Todavía no hay planos cargados para este proyecto.');
  renderAdminTools();
 }
 async function loadPlanScene(){
  const plan=planById();
  state.zoom=1;state.panX=0;state.panY=0;setZoom(1);
  state.scene=null;
  state.selectedId='';
  state.draft=null;
  renderPropertyList();
  renderInspector();
  if(!plan){
   $('.plans-surface').hidden=true;
   $('.plans-stage-message').hidden=false;
   $('.plans-stage-message').textContent='Selecciona un plano para visualizar sus propiedades.';
   renderDrawTools();
   return;
  }
  state.loadingPlan=true;
  $('.plans-stage-message').hidden=false;
  $('.plans-stage-message').textContent='Procesando plano…';
  $('.plans-surface').hidden=true;
  $('[data-role="pdf-canvas"]').hidden=true;
  try{
   if(plan.source_type==='pdf')await renderPdf(plan);
   else await renderDxf(plan);
   state.loadingPlan=false;
   renderSvg();
   renderDrawTools();
   renderPropertyList();
   if(plan.source_width!==state.scene.width||plan.source_height!==state.scene.height){
    if(getIsAdmin()){
     const {error}=await getSupabase().from('property_plans').update({source_width:state.scene.width,source_height:state.scene.height}).eq('id',plan.id);
     if(error)statusMessage(`El plano se visualizó, pero no se guardaron sus dimensiones: ${error.message}`);
     else{plan.source_width=state.scene.width;plan.source_height=state.scene.height}
    }
   }
  }catch(error){
   state.loadingPlan=false;
   $('.plans-stage-message').textContent=`No se pudo abrir el plano: ${error.message}`;
   statusMessage(error.message);
  }
 }
 async function renderPdf(plan){
  let pdfjs;
  try{pdfjs=await import(`https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.mjs`)}
  catch(error){throw new Error(`No se pudo cargar el lector PDF del navegador: ${error.message}`)}
  pdfjs.GlobalWorkerOptions.workerSrc=`https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;
  const document=await pdfjs.getDocument({url:publicPlanUrl(plan)}).promise;
  state.pdfDocument=document;
  if(plan.page_number>document.numPages)throw new Error(`El plano tiene ${document.numPages} páginas; selecciona una página válida editando el plano.`);
  const page=await document.getPage(plan.page_number);
  const viewport=page.getViewport({scale:1});
  const textContent=await page.getTextContent();
  const labels=parsePdfLotLabels(textContent,viewport,pdfjs.Util.transform);
  const canvas=$('[data-role="pdf-canvas"]'),context=canvas.getContext('2d');
  const scale=Math.min(2.5,2000/Math.max(viewport.width,viewport.height));
  const rendered=page.getViewport({scale});
  canvas.width=Math.ceil(rendered.width);
  canvas.height=Math.ceil(rendered.height);
  canvas.style.aspectRatio=`${viewport.width}/${viewport.height}`;
  await page.render({canvasContext:context,viewport:rendered}).promise;
  state.scene={width:viewport.width,height:viewport.height,background:'pdf',polygons:[],labels};
  canvas.hidden=false;
 }
 async function renderDxf(plan){
  const response=await fetch(publicPlanUrl(plan));
  if(!response.ok)throw new Error(`El archivo DXF no pudo descargarse (HTTP ${response.status}).`);
  const scene=parseDxf(await response.text());
  state.scene={...scene,background:'dxf'};
  $('[data-role="pdf-canvas"]').hidden=true;
 }

 function renderPropertyList(){
  const query=$('[data-field="search"]').value.trim().toLocaleLowerCase('es');
  const status=$('[data-field="status-filter"]').value;
  const visible=state.units.filter(unit=>unit.plan_id===state.planId&&(!status||unit.status===status)&&(!query||[
   unit.code,unit.block,unit.address,unit.location_label,unit.building,unit.tower,unit.floor_label,unit.property_type
  ].some(value=>String(value||'').toLocaleLowerCase('es').includes(query))));
  $('[data-role="property-list"]').innerHTML=visible.length?visible.map(unit=>`<button type="button" class="plan-property ${unit.id===state.selectedId?'selected':''}" data-unit-id="${attr(unit.id)}"><i style="--property-color:${propertyColor(unit.status)}"></i><span><b>${attr(unit.code)}</b><small>${attr(unit.block?`Mz. ${unit.block} · `:'')}${attr(unit.floor_label||unit.tower||unit.property_type)} · ${attr(PROPERTY_STATUS[unit.status]?.label||unit.status)}</small></span></button>`).join(''):'<p class="plans-empty">No hay propiedades que coincidan con la búsqueda.</p>';
  $('[data-role="property-list"]').querySelectorAll('[data-unit-id]').forEach(button=>button.onclick=()=>selectUnit(button.dataset.unitId));
  renderSvg();
 }
 function selectUnit(id){
  state.selectedId=id;
  state.draft=null;
  const unit=selectedUnit();
  if(unit)onSelectProject(unit.project_id);
  renderPropertyList();
  renderInspector();
  renderSvg();
 }
 function renderAdminTools(){
  const container=$('[data-role="admin-tools"]');
  if(!getIsAdmin()){
   container.innerHTML='';
   return;
  }
  const project=projectById();
  const supported=Boolean(project);
  container.innerHTML=`<details><summary>Agregar plano PDF/DXF</summary><form data-form="upload-plan"><label>Nombre del plano<input name="name" maxlength="100" placeholder="Ej. Plano de lotización" required></label><label>Piso / torre (opcional)<input name="floor" maxlength="80" placeholder="Ej. Torre A · Piso 3"></label><label>Página PDF<input name="page_number" type="number" min="1" step="1" value="1"></label><label>Archivo PDF o DXF<input name="file" type="file" accept=".pdf,.dxf,application/pdf,application/dxf" required></label><p class="plans-note">DWG: expórtalo a DXF antes de cargarlo. El plano queda almacenado en Supabase.</p><button type="submit" ${supported?'':'disabled'}>Subir plano</button></form></details>${state.planId?'<button type="button" data-action="new-property">Nueva propiedad</button><button type="button" data-action="delete-plan" class="danger">Eliminar plano y sus propiedades</button>':''}`;
  const form=container.querySelector('[data-form="upload-plan"]');
  form.onsubmit=event=>uploadPlan(event).catch(error=>statusMessage(error.message));
  container.querySelector('[data-action="new-property"]')?.addEventListener('click',newProperty);
  container.querySelector('[data-action="delete-plan"]')?.addEventListener('click',deletePlan);
 }
 async function uploadPlan(event){
  event.preventDefault();
  const form=event.currentTarget,project=projectById(),file=form.elements.file.files[0];
  if(!getIsAdmin()||!project)throw new Error('Inicia sesión como administrador y selecciona un proyecto.');
  if(!file)throw new Error('Selecciona un plano PDF o DXF.');
  const ext=file.name.split('.').pop().toLowerCase();
  if(!['pdf','dxf'].includes(ext))throw new Error('Solo se admiten planos PDF y DXF. Convierte los DWG a DXF antes de subirlos.');
  if(file.size>25*1024*1024)throw new Error('El plano supera el límite de 25 MB.');
  const sourceType=ext,mimeType=sourceType==='pdf'?'application/pdf':'application/dxf';
  const path=`plans/${project.id}/${crypto.randomUUID()}-${slug(file.name)}`;
  statusMessage('Subiendo plano…');
  const {data:stored,error:uploadError}=await getSupabase().storage.from(BUCKET).upload(path,file,{contentType:mimeType,upsert:false});
  if(uploadError)throw new Error(`No se pudo subir el plano: ${uploadError.message}`);
  const pageNumber=Number(form.elements.page_number.value||1);
  const planData={project_id:project.id,name:form.elements.name.value.trim(),floor_label:form.elements.floor.value.trim()||null,source_type:sourceType,file_path:stored.path,file_name:file.name,page_number:sourceType==='pdf'?pageNumber:1,created_by:getUser()?.id||null};
  const {data,error}=await getSupabase().from('property_plans').insert(planData).select().single();
  if(error){
   const {error:cleanupError}=await getSupabase().storage.from(BUCKET).remove([stored.path]);
   throw new Error(`No se pudo guardar el plano: ${error.message}${cleanupError?` No se pudo limpiar el archivo subido: ${cleanupError.message}`:''}`);
  }
  state.plans.push(data);
  state.planId=data.id;
  state.selectedPlanByProject.set(project.id,data.id);
  renderPlanOptions();
  state.zoom=1;state.panX=0;state.panY=0;
  setZoom(1);
  statusMessage('Plano guardado en Supabase.');
  await loadPlanScene();
  if(project.id==='joya-verde'&&file.name==='LA AUVERNIA LOTIZACION (1)-Model.octubre.pdf'&&state.scene?.labels.length){
   try{await importPdfLots()}
   catch(error){statusMessage(`El plano de JOYA VERDE se guardó, pero no se pudieron importar sus lotes: ${error.message}`)}
  }
 }
 async function deletePlan(){
  const plan=planById();
  if(!getIsAdmin()||!plan||!window.confirm(`¿Eliminar el plano "${plan.name}" y todas sus propiedades asociadas?`))return;
  const {error}=await getSupabase().from('property_plans').delete().eq('id',plan.id);
  if(error){statusMessage(`No se pudo eliminar el plano: ${error.message}`);return}
  const {error:storageError}=await getSupabase().storage.from(BUCKET).remove([plan.file_path]);
  state.plans=state.plans.filter(item=>item.id!==plan.id);
  state.units=state.units.filter(item=>item.plan_id!==plan.id);
  state.selectedPlanByProject.delete(plan.project_id);
  state.planId='';
  state.selectedId='';
  state.scene=null;
  renderPlanOptions();renderPropertyList();renderInspector();
  await loadPlanScene();
  statusMessage(storageError?`El plano y sus propiedades se eliminaron, pero no se pudo borrar el archivo almacenado: ${storageError.message}`:'Plano y propiedades eliminados.');
 }
 function newProperty(){
  const project=projectById(),plan=planById();
  if(!project||!plan)return;
  const sequence=state.units.filter(unit=>unit.plan_id===plan.id).length+1;
  state.draft=emptyProperty(project,plan,sequence);
  state.selectedId='draft';
  state.drawing=false;
  state.drawPoints=[];
  renderInspector();
  renderDrawTools();
  renderSvg();
 }
 function renderInspector(){
  const container=$('[data-role="inspector"]');
  const unit=state.draft||selectedUnit();
  if(!unit){
   container.innerHTML='<h2>Ficha de propiedad</h2><p>Elige una figura del plano para consultar sus datos.</p>';
   return;
  }
  const editable=getIsAdmin();
  const field=(name,label,value,type='text',step='')=>`<label>${label}<input name="${name}" type="${type}" ${step?`step="${step}"`:''} value="${attr(value??'')}" ${editable?'':'readonly'}></label>`;
  const selectStatus=`<label>Estado<select name="status" ${editable?'':'disabled'}>${Object.entries(PROPERTY_STATUS).map(([key,item])=>`<option value="${key}" ${unit.status===key?'selected':''}>${item.label}</option>`).join('')}</select></label>`;
  const typeSelect=`<label>Tipo<select name="property_type" ${editable?'':'disabled'}>${PROPERTY_TYPES.map(type=>`<option ${unit.property_type===type?'selected':''}>${type}</option>`).join('')}</select></label>`;
  const fields=[typeSelect,field('code','Código o número',unit.code),selectStatus];
  if(unit.property_type==='Lote'){
   if(state.projectId!=='joya-verde')fields.push(field('block','Manzana',unit.block));
   fields.push(field('area_land_m2','Área oficial del terreno (m²)',unit.area_land_m2,'number','0.01'),field('frontage_m','Frente oficial (m)',unit.frontage_m,'number','0.01'));
  }else if(unit.property_type==='Casa'){
   fields.push(field('address','Dirección',unit.address),field('location_label','Ubicación en el proyecto',unit.location_label),field('area_land_m2','Área oficial del terreno (m²)',unit.area_land_m2,'number','0.01'),field('area_covered_m2','Área construida oficial (m²)',unit.area_covered_m2,'number','0.01'),field('floors','Pisos',unit.floors,'number','1'),field('bedrooms','Dormitorios',unit.bedrooms,'number','1'),field('bathrooms','Baños',unit.bathrooms,'number','1'));
  }else{
   fields.push(field('building','Edificio',unit.building),field('tower','Torre',unit.tower),field('floor_label','Piso',unit.floor_label),field('area_total_m2','Área total oficial (m²)',unit.area_total_m2,'number','0.01'),field('area_covered_m2','Área techada oficial (m²)',unit.area_covered_m2,'number','0.01'),field('other_areas_m2','Otras áreas oficiales (m²)',unit.other_areas_m2,'number','0.01'),field('bedrooms','Dormitorios',unit.bedrooms,'number','1'),field('bathrooms','Baños',unit.bathrooms,'number','1'));
  }
  fields.push(field('price','Precio (S/)',unit.price,'number','0.01'));
  fields.push(`<label>Observaciones<textarea name="observations" ${editable?'':'readonly'}>${attr(unit.observations||'')}</textarea></label>`);
  const geometry=unit.geometry?.coordinates?.[0]||[];
  const pdfLabel=unit.property_type==='Lote'&&state.scene?.background==='pdf'
   ?state.scene.labels.find(label=>label.code===unit.code)
   :null;
  container.innerHTML=`<h2>${unit.id?'Propiedad':'Nueva propiedad'}</h2><p class="plans-property-kind">${attr(unit.property_type)} · ${attr(planById()?.name||'')}</p><form data-form="property">${fields.join('')}${editable?`<div class="plans-edit-actions"><button type="submit">Guardar cambios</button><button type="button" data-action="draw">${geometry.length?'Redibujar contorno':'Dibujar contorno'}</button>${pdfLabel&&unit.geometry?.type!=='Point'?'<button type="button" data-action="restore-pdf-marker">Restaurar marcador PDF</button>':''}${unit.id?'<button type="button" data-action="delete" class="danger">Eliminar</button>':''}</div>`:''}</form>`;
  const form=container.querySelector('[data-form="property"]');
  if(editable){
   form.onsubmit=event=>saveProperty(event).catch(error=>statusMessage(`No se pudieron guardar los cambios: ${error.message}`));
   form.querySelector('[name="status"]').onchange=()=>{updateDraftFromForm(form);renderPropertyList();renderSvg()};
   form.querySelector('[name="property_type"]').onchange=()=>{updateDraftFromForm(form);renderInspector()};
   form.querySelector('[data-action="draw"]').onclick=()=>{updateDraftFromForm(form);state.drawing=true;state.drawPoints=[];renderDrawTools();renderSvg();statusMessage('Pulsa los puntos del contorno en el plano y termina en Cerrar contorno.')};
   form.querySelector('[data-action="restore-pdf-marker"]')?.addEventListener('click',()=>{
    updateDraftFromForm(form);
    unit.geometry={type:'Point',coordinates:[pdfLabel.x,pdfLabel.y]};
    renderInspector();
    renderSvg();
    statusMessage('Marcador devuelto a la etiqueta original del PDF. Guarda los cambios para sincronizarlo.');
   });
   form.querySelector('[data-action="delete"]')?.addEventListener('click',()=>deleteProperty().catch(error=>statusMessage(`No se pudo eliminar la propiedad: ${error.message}`)));
  }
 }
 function updateDraftFromForm(form){
  const data=new FormData(form),unit=state.draft||selectedUnit();
  if(!unit)return;
  if(state.projectId==='joya-verde')unit.block=null;
  for(const [key,value] of data){
   if(['area_land_m2','area_total_m2','area_covered_m2','other_areas_m2','frontage_m','back_m','side_a_m','side_b_m','floors','bedrooms','bathrooms','price'].includes(key))unit[key]=numberValue(value);
   else unit[key]=String(value).trim();
  }
 }
 async function saveProperty(event){
  event.preventDefault();
  if(!getIsAdmin())throw new Error('Solo administradores pueden editar propiedades.');
  const form=event.currentTarget,unit=state.draft||selectedUnit();
  updateDraftFromForm(form);
  if(!unit?.code.trim())return statusMessage('El código de la propiedad es obligatorio.');
  const coordinates=unit.geometry?.coordinates;
  const hasPolygon=unit.geometry?.type==='Polygon'&&Array.isArray(coordinates?.[0])&&coordinates[0].length>=3;
  const hasPoint=unit.geometry?.type==='Point'&&Array.isArray(coordinates)&&coordinates.length===2&&coordinates.every(Number.isFinite);
  if(!hasPolygon&&!hasPoint)return statusMessage('Dibuja y cierra el contorno de la propiedad antes de guardar.');
  const record={...unit,geometry:unit.geometry,created_by:unit.created_by||getUser()?.id||null};
  delete record.id;
  delete record.owner;
  const response=unit.id
   ?await getSupabase().from('property_units').update(record).eq('id',unit.id).select().single()
   :await getSupabase().from('property_units').insert(record).select().single();
  if(response.error){statusMessage(`No se pudieron guardar los cambios: ${response.error.message}`);return}
  const saved=response.data;
  state.units=state.units.filter(item=>item.id!==saved.id);
  state.units.push(saved);
  state.selectedId=saved.id;
  state.draft=null;
  renderPropertyList();renderSvg();renderInspector();
  renderPropertyList();
  renderInspector();
  renderSvg();
  statusMessage('Propiedad y contorno guardados en Supabase.');
 }
 async function deleteProperty(){
  const unit=selectedUnit();
  if(!unit||!getIsAdmin()||!window.confirm(`¿Eliminar permanentemente la propiedad ${unit.code}?`))return;
  const {error}=await getSupabase().from('property_units').delete().eq('id',unit.id);
  if(error){statusMessage(`No se pudo eliminar la propiedad: ${error.message}`);return}
  state.units=state.units.filter(item=>item.id!==unit.id);
  state.selectedId='';
  renderPropertyList();
  renderInspector();
  renderSvg();
  statusMessage('Propiedad eliminada.');
 }

 function renderSvg(){
  const svg=$('[data-role="plan-svg"]');
  if(!state.scene){svg.replaceChildren();return}
  svg.setAttribute('viewBox',`0 0 ${state.scene.width} ${state.scene.height}`);
  svg.innerHTML=`${state.scene.background==='dxf'?`<g class="dxf-background">${state.scene.paths}</g>`:''}<g class="property-shapes">${state.units.filter(unit=>unit.plan_id===state.planId).map(renderPropertyShape).join('')}${state.draft?renderPolygon(state.draft):''}</g><g class="drawing-points">${state.drawPoints.length?`<polyline points="${state.drawPoints.map(point=>point.join(',')).join(' ')}"></polyline>${state.drawPoints.map(([x,y])=>`<circle cx="${x}" cy="${y}" r="${Math.max(state.scene.width,state.scene.height)*.006}"></circle>`).join('')}`:''}</g>`;
  svg.onclick=event=>{
   if(!state.drawing)return;
   const point=svgPoint(svg,event);
   state.drawPoints.push(point);
   renderSvg();
  };
  svg.querySelectorAll('[data-property-id]').forEach(shape=>shape.onclick=event=>{
   if(state.drawing)return;
   event.stopPropagation();
   selectUnit(shape.dataset.propertyId);
  });
  svg.querySelectorAll('[data-property-id]').forEach(shape=>shape.onkeydown=event=>{
   if(!state.drawing&&(event.key==='Enter'||event.key===' ')){
    event.preventDefault();
    selectUnit(shape.dataset.propertyId);
   }
  });
  $('.plans-surface').hidden=false;
  $('.plans-stage-message').hidden=true;
  applyPanZoom();
 }
 function renderPolygon(unit){
  const points=unit.geometry?.coordinates?.[0];
  if(!Array.isArray(points)||points.length<3)return'';
  const color=propertyColor(unit.status);
  const selected=unit.id===state.selectedId;
  const labelPoint=points.reduce((sum,point)=>[sum[0]+point[0]/points.length,sum[1]+point[1]/points.length],[0,0]);
  const id=unit.id||'draft';
  return `<g class="plan-unit ${selected?'selected':''}" data-property-id="${attr(id)}" tabindex="0" role="button" aria-label="${attr(unit.code)} · ${attr(PROPERTY_STATUS[unit.status]?.label||unit.status)}"><polygon points="${points.map(point=>point.map(Number).join(',')).join(' ')}" fill="${color}" fill-opacity="${selected?'.65':'.35'}" stroke="${selected?'#007AFF':color}" stroke-width="${Math.max(state.scene.width,state.scene.height)*.004}" vector-effect="non-scaling-stroke"></polygon><text x="${labelPoint[0]}" y="${labelPoint[1]}" text-anchor="middle" dominant-baseline="middle">${attr(unit.code)}</text></g>`;
 }
 function renderPropertyShape(unit){
  if(unit.geometry?.type==='Point'&&Array.isArray(unit.geometry.coordinates)&&unit.geometry.coordinates.length===2){
   const [x,y]=unit.geometry.coordinates.map(Number),radius=Math.max(14,Math.max(state.scene.width,state.scene.height)*.012),selected=unit.id===state.selectedId;
   return `<g class="plan-unit ${selected?'selected':''}" data-property-id="${attr(unit.id)}" tabindex="0" role="button" aria-label="${attr(unit.code)} · ${attr(PROPERTY_STATUS[unit.status]?.label||unit.status)}"><circle cx="${x}" cy="${y}" r="${radius}" fill="${propertyColor(unit.status)}" fill-opacity=".94" stroke="${selected?'#007AFF':'#fff'}" stroke-width="${selected?3:1.5}" vector-effect="non-scaling-stroke"><title>${attr(unit.code)}</title></circle><text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" style="font-size:${Math.max(12,Math.max(state.scene.width,state.scene.height)*.018)}px;fill:#fff;stroke:#17212b;stroke-width:.8px">${attr(unit.code.replace(/^LOTE\s*/i,''))}</text></g>`;
  }
  return renderPolygon(unit);
 }
 function svgPoint(svg,event){
  const point=svg.createSVGPoint();
  point.x=event.clientX;point.y=event.clientY;
  const converted=point.matrixTransform(svg.getScreenCTM().inverse());
  return[Math.max(0,Math.min(state.scene.width,converted.x)),Math.max(0,Math.min(state.scene.height,converted.y))];
 }
 function renderDrawTools(){
  const tools=$('[data-role="draw-tools"]');
  if(!planById()||!state.scene){tools.innerHTML='';return}
  if(!getIsAdmin()){tools.innerHTML='<span>Verde: disponible · Amarillo: reservado · Rojo: vendido · Morado: bloqueado · Gris: por confirmar</span>';return}
  const plan=planById();
  const pdfLots=state.scene.background==='pdf'?state.scene.labels:[];
  const existingLotCodes=new Set(state.units.filter(unit=>unit.plan_id===plan.id&&unit.property_type==='Lote').map(unit=>unit.code));
  const importablePdfLots=pdfLots.filter(lot=>!existingLotCodes.has(lot.code));
  tools.innerHTML=`${state.drawing?'<button type="button" data-action="finish-drawing">Cerrar contorno</button><button type="button" data-action="cancel-drawing">Cancelar</button>':''}${plan.source_type==='dxf'&&state.scene.polygons.length?`<button type="button" data-action="import-contours">Importar ${state.scene.polygons.length} contornos DXF</button>`:''}${importablePdfLots.length?`<button type="button" data-action="import-pdf-lots">Importar ${importablePdfLots.length} lotes numerados detectados</button>`:pdfLots.length?`<span>${pdfLots.length} lotes numerados detectados.</span>`:''}`;
  tools.querySelector('[data-action="finish-drawing"]')?.addEventListener('click',finishDrawing);
  tools.querySelector('[data-action="cancel-drawing"]')?.addEventListener('click',()=>{state.drawing=false;state.drawPoints=[];renderDrawTools();renderSvg()});
  tools.querySelector('[data-action="import-contours"]')?.addEventListener('click',()=>importDxfContours().catch(error=>statusMessage(`No se pudieron importar los contornos: ${error.message}`)));
  tools.querySelector('[data-action="import-pdf-lots"]')?.addEventListener('click',()=>importPdfLots().catch(error=>statusMessage(`No se pudieron importar los lotes del PDF: ${error.message}`)));
 }
 function finishDrawing(){
  if(state.drawPoints.length<3){statusMessage('Un contorno necesita al menos tres puntos.');return}
  const unit=state.draft||selectedUnit();
  if(!unit)return;
  unit.geometry={type:'Polygon',coordinates:[[...state.drawPoints]]};
  state.drawing=false;
  state.drawPoints=[];
  renderDrawTools();
  renderSvg();
  renderInspector();
  statusMessage('Contorno listo. Guarda los cambios para sincronizarlo.');
 }
 async function importDxfContours(){
  const plan=planById(),project=projectById();
  if(!getIsAdmin()||!plan||!project||!state.scene?.polygons?.length)return;
  if(!window.confirm(`Crear ${state.scene.polygons.length} registros editables sin inventar códigos, áreas oficiales ni precios?`))return;
  const existing=state.units.filter(unit=>unit.plan_id===plan.id).length;
  const records=state.scene.polygons.map((points,index)=>({
   project_id:project.id,plan_id:plan.id,property_type:defaultType(project),code:`${defaultType(project)} ${existing+index+1}`,status:'unknown',
   geometry:{type:'Polygon',coordinates:[points]},created_by:getUser()?.id||null
  }));
  const {data,error}=await getSupabase().from('property_units').insert(records).select();
  if(error){statusMessage(`No se pudieron importar los contornos: ${error.message}`);return}
  state.units.push(...data);
  renderPropertyList();renderSvg();renderDrawTools();
  statusMessage(`Se importaron ${data.length} contornos. Completa los códigos, medidas oficiales y precios.`);
 }
 async function importPdfLots(){
  const plan=planById(),project=projectById();
  if(!getIsAdmin()||!plan||!project||state.scene?.background!=='pdf')return;
  const existingCodes=new Set(state.units.filter(unit=>unit.plan_id===plan.id&&unit.property_type==='Lote').map(unit=>unit.code));
  const labels=state.scene.labels.filter(label=>!existingCodes.has(label.code));
  if(!labels.length){statusMessage('Los lotes numerados de este plano ya están importados.');return}
  const records=labels.map(label=>({
   project_id:project.id,plan_id:plan.id,property_type:'Lote',code:label.code,
   area_land_m2:label.area,status:'unknown',observations:label.observations||null,
   geometry:{type:'Point',coordinates:[label.x,label.y]},created_by:getUser()?.id||null
  }));
  const {data,error}=await getSupabase().from('property_units').insert(records).select();
  if(error)throw new Error(error.message);
  state.units.push(...data);
  renderPropertyList();renderInspector();renderSvg();renderDrawTools();
  statusMessage(`Se importaron ${data.length} lotes numerados desde el PDF. Las áreas con discrepancias quedan pendientes de validar; el estado y el precio no se inventaron.`);
 }

 function bindPan(){
  const pan=$('[data-role="pan"]');
  pan.addEventListener('pointerdown',event=>{
   if(state.drawing||event.target.closest('.plan-unit'))return;
   state.drag={x:event.clientX-state.panX,y:event.clientY-state.panY,pointerId:event.pointerId};
   pan.setPointerCapture(event.pointerId);
  });
  pan.addEventListener('pointermove',event=>{
   if(!state.drag)return;
   state.panX=event.clientX-state.drag.x;state.panY=event.clientY-state.drag.y;applyPanZoom();
  });
  const end=()=>{state.drag=null};
  pan.addEventListener('pointerup',end);pan.addEventListener('pointercancel',end);
 }
 function setZoom(value){
  state.zoom=Math.max(.5,Math.min(4,Math.round(value*10)/10));
  $('[data-field="zoom"]').value=state.zoom;
  $('[data-role="zoom-label"]').textContent=`${Math.round(state.zoom*100)}%`;
  applyPanZoom();
 }
 function applyPanZoom(){
  const surface=$('[data-role="surface"]'),scene=state.scene;
  if(scene){
   const pan=$('[data-role="pan"]'),width=pan.clientWidth,height=pan.clientHeight;
   if(width&&height){
    const fit=Math.min(width/scene.width,height/scene.height);
    surface.style.width=`${scene.width*fit}px`;
    surface.style.height=`${scene.height*fit}px`;
   }
  }
  surface.style.transform=`translate(${state.panX}px,${state.panY}px) scale(${state.zoom})`;
 }

 initializeSelectors();
 window.addEventListener('resize',applyPanZoom);
 document.getElementById('plans-button').disabled=false;
 return{open,close};
}
