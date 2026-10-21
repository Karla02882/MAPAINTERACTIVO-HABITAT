const BUCKET='project-files';
const PDFJS_VERSION='4.10.38';
const PROPERTY_TYPES=['Lote','Casa','Departamento'];
const HUERTAS_SICAYA_DXF='Lotizacion Sicaya Las Huertas.dxf';
const HUERTAS_SICAYA_LOTS=[
 {block:'A',number:7,area:90.01,price:35000,status:'sold'},
 {block:'A',number:4,area:90.29,price:35000,status:'available'},
 {block:'B',number:7,area:90.93,price:35000,status:'blocked'},
 {block:'B',number:3,area:90.27,price:41000,status:'sold'},
 {block:'B',number:4,area:90.66,price:35000,status:'available'},
 {block:'B',number:5,area:90.88,price:30000,status:'available'},
 {block:'A',number:1,area:94.25,price:42000,status:'available'},
 {block:'A',number:5,area:90.67,price:30000,status:'available'},
 {block:'A',number:6,area:90.28,price:25000,status:'available'},
 {block:'B',number:6,area:91.7,price:39000,status:'sold'},
 {block:'B',number:2,area:104.85,price:50000,status:'available'},
 {block:'A',number:2,area:103.98,price:50000,status:'available'},
 {block:'A',number:3,area:90.51,price:35000,status:'available'},
 {block:'B',number:1,area:100.79,price:44000,status:'available'}
];
const PROPERTY_STATUS={
 available:{label:'Disponible',color:'#34C759'},
 reserved:{label:'Reservado',color:'#FFCC00'},
 sold:{label:'Vendido',color:'#FF3B30'},
 blocked:{label:'Bloqueado',color:'#8E8E93'}
};
const attr=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const slug=value=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'')||'plano';
const numberValue=value=>value===''||value==null?null:Number(value);
const comparePropertyCodes=(first,second)=>String(first.code).localeCompare(String(second.code),'es',{numeric:true,sensitivity:'base'});
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
  const layer=data.find(([code])=>code===8)?.[1]||'0';
  if(kind==='LWPOLYLINE'){
   const points=[];
   for(let j=0;j<data.length;j++){
    if(data[j][0]===10){
     const y=data.slice(j+1).find(([code])=>code===20||code===10);
     const yValue=y?.[0]===20?y[1]:undefined;
     if(yValue!==undefined)points.push([Number(data[j][1]),Number(yValue)]);
    }
   }
   if(points.length>1)entities.push({type:'polyline',layer,points,closed:(Number(data.find(([code])=>code===70)?.[1]||0)&1)===1});
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
   if(points.length>1)entities.push({type:'polyline',layer,points,closed});
  }else if(kind==='LINE'){
   const x1=data.find(([code])=>code===10)?.[1],y1=data.find(([code])=>code===20)?.[1];
   const x2=data.find(([code])=>code===11)?.[1],y2=data.find(([code])=>code===21)?.[1];
   if([x1,y1,x2,y2].every(value=>value!==undefined))entities.push({type:'line',layer,points:[[Number(x1),Number(y1)],[Number(x2),Number(y2)]],closed:false});
  }else if(kind==='CIRCLE'){
   const x=data.find(([code])=>code===10)?.[1],y=data.find(([code])=>code===20)?.[1],r=data.find(([code])=>code===40)?.[1];
   if([x,y,r].every(value=>value!==undefined))entities.push({type:'circle',layer,center:[Number(x),Number(y)],radius:Number(r)});
  }else if(kind==='TEXT'||kind==='MTEXT'){
   const text=data.filter(([code])=>code===1||code===3).map(([,value])=>value).join('').replace(/\\P/g,' ').trim();
   const x=data.find(([code])=>code===10)?.[1],y=data.find(([code])=>code===20)?.[1];
   if(text&&x!==undefined&&y!==undefined)entities.push({type:'text',layer,text,position:[Number(x),Number(y)]});
  }
 }
 const coordinates=entities.flatMap(entity=>entity.type==='circle'?[
  [entity.center[0]-entity.radius,entity.center[1]-entity.radius],
  [entity.center[0]+entity.radius,entity.center[1]+entity.radius]
 ]:entity.points||[]);
 if(!coordinates.length)throw new Error('No se encontraron contornos, líneas o círculos compatibles en el DXF.');
 const minX=Math.min(...coordinates.map(point=>point[0])),maxX=Math.max(...coordinates.map(point=>point[0]));
 const minY=Math.min(...coordinates.map(point=>point[1])),maxY=Math.max(...coordinates.map(point=>point[1]));
 const width=maxX-minX||1,height=maxY-minY||1;
 const mapPoint=([x,y])=>[x-minX,maxY-y];
 const paths=[],polygons=[],labels=[];
 entities.forEach(entity=>{
  if(entity.type==='text'){
   labels.push({layer:entity.layer,text:entity.text,position:mapPoint(entity.position)});
   return;
  }
  if(entity.type==='circle'){
   const [x,y]=mapPoint(entity.center);
   paths.push(`<circle cx="${x}" cy="${y}" r="${entity.radius}" />`);
   return;
  }
  const points=entity.points.map(mapPoint);
  const d=points.map(([x,y],index)=>`${index?'L':'M'}${x} ${y}`).join(' ')+(entity.closed?' Z':'');
  paths.push(`<path d="${d}" />`);
  if(entity.closed&&points.length>=3){
   const area=Math.abs(points.reduce((sum,[x,y],index)=>{
    const [nextX,nextY]=points[(index+1)%points.length];
    return sum+x*nextY-nextX*y;
   },0))/2;
   polygons.push({layer:entity.layer,points,area});
  }
 });
 return{width,height,paths:paths.join(''),polygons,labels};
}

function sceneViewport(scene){
 return scene.viewBox||{x:0,y:0,width:scene.width,height:scene.height};
}

function isHuertasSicayaPlan(project,plan){
 return project?.id==='las-huertas-de-sicaya'&&(
  plan?.file_name?.trim().toLocaleLowerCase('es')===HUERTAS_SICAYA_DXF.toLocaleLowerCase('es')
  ||plan?.source_type==='pdf'&&plan?.name?.toLocaleLowerCase('es').includes('lotizaci')
 );
}

export function matchHuertasSicayaLots(scene){
 const parcelPolygons=scene.polygons.filter(polygon=>polygon.layer==='VIVIENDA');
 const lotLabels=scene.labels.filter(label=>label.layer==='VIVIENDA'&&/^\d+$/.test(label.text));
 const blockLabels=scene.labels.filter(label=>label.layer==='MANZANAS'&&/^[AB]$/i.test(label.text));
 const centroid=points=>points.reduce((sum,[x,y])=>[sum[0]+x/points.length,sum[1]+y/points.length],[0,0]);
 const distance=(first,second)=>Math.hypot(first[0]-second[0],first[1]-second[1]);
 const eligible=HUERTAS_SICAYA_LOTS.map(lot=>parcelPolygons.map(polygon=>{
   const center=centroid(polygon.points);
   const matchingNumber=lotLabels.map(label=>({label,distance:distance(center,label.position)}))
    .filter(match=>Number(match.label.text)===lot.number&&match.distance<=3)
    .sort((first,second)=>first.distance-second.distance)[0];
   if(Math.abs(polygon.area-lot.area)>.02||!matchingNumber)return null;
   return{polygon,center,score:Math.abs(polygon.area-lot.area)+matchingNumber.distance*.001};
  }).filter(Boolean));
 const anchorIndex=HUERTAS_SICAYA_LOTS.findIndex(lot=>lot.block==='A'&&lot.number===1);
 for(const anchor of eligible[anchorIndex]){
  const nearestBlock=letter=>blockLabels.filter(label=>label.text.toUpperCase()===letter)
   .map(label=>({label,distance:distance(anchor.center,label.position)}))
   .sort((first,second)=>first.distance-second.distance)[0];
  const blockA=nearestBlock('A'),blockB=nearestBlock('B');
  if(!blockA||!blockB||blockA.distance>60||blockB.distance>60)continue;
  const deltaX=blockB.label.position[0]-blockA.label.position[0];
  const deltaY=blockB.label.position[1]-blockA.label.position[1];
  const midpoint=blockA.label.position.map((value,index)=>(value+blockB.label.position[index])/2);
  const isBlockA=center=>Math.abs(deltaX)>=Math.abs(deltaY)
   ?(center[0]-midpoint[0])*deltaX<0
   :(center[1]-midpoint[1])*deltaY<0;
  const selected=[],used=new Set();
  let complete=true;
  for(let index=0;index<eligible.length;index++){
   const matches=eligible[index],lot=HUERTAS_SICAYA_LOTS[index];
   const candidate=matches
    .filter(match=>!used.has(match.polygon)&&distance(anchor.center,match.center)<=55&&isBlockA(match.center)===(lot.block==='A'))
    .sort((first,second)=>first.score-second.score)[0];
   if(!candidate){complete=false;break}
   selected.push(candidate.polygon);
   used.add(candidate.polygon);
  }
  if(complete)return HUERTAS_SICAYA_LOTS.map((lot,index)=>({lot,polygon:selected[index]}));
 }
 return[];
}
export function matchHuertasSicayaPdfLots(polygons){
 const parcels=polygons.filter(polygon=>polygon.area>=5000&&polygon.area<=7000);
 if(parcels.length!==HUERTAS_SICAYA_LOTS.length)return[];
 const center=polygon=>polygon.points.reduce((sum,[x,y])=>[sum[0]+x/polygon.points.length,sum[1]+y/polygon.points.length],[0,0]);
 const ordered=parcels.map(polygon=>({polygon,center:center(polygon)}));
 const midpointY=(Math.min(...ordered.map(item=>item.center[1]))+Math.max(...ordered.map(item=>item.center[1])))/2;
 const upper=ordered.filter(item=>item.center[1]<midpointY),lower=ordered.filter(item=>item.center[1]>=midpointY);
 if(upper.length!==7||lower.length!==7)return[];
 const byLotNumber=new Map();
 for(const [block,group] of [['A',upper],['B',lower]]){
  const byX=group.slice().sort((first,second)=>first.center[0]-second.center[0]);
  const sideLots=byX.slice(0,2).sort((first,second)=>first.center[1]-second.center[1]);
  const streetLots=byX.slice(2);
  if(sideLots.length!==2||streetLots.length!==5)return[];
  [...sideLots,...streetLots].forEach((item,index)=>byLotNumber.set(`${block}:${index+1}`,item.polygon));
 }
 return HUERTAS_SICAYA_LOTS.map(lot=>{
  const polygon=byLotNumber.get(`${lot.block}:${lot.number}`);
  return polygon?{lot,polygon}:null;
 }).filter(Boolean);
}

export function parsePdfVectorPolygons(operatorList,viewport,pdfjs){
 const command={moveTo:pdfjs.OPS.moveTo,lineTo:pdfjs.OPS.lineTo,curveTo:pdfjs.OPS.curveTo,curveTo2:pdfjs.OPS.curveTo2,curveTo3:pdfjs.OPS.curveTo3,closePath:pdfjs.OPS.closePath,rectangle:pdfjs.OPS.rectangle};
 const paths=[],stack=[];
 let transform=[1,0,0,1,0,0];
 for(let index=0;index<operatorList.fnArray.length;index++){
  const operation=operatorList.fnArray[index],args=operatorList.argsArray[index];
  if(operation===pdfjs.OPS.save){stack.push(transform);continue}
  if(operation===pdfjs.OPS.restore){transform=stack.pop()||[1,0,0,1,0,0];continue}
  if(operation===pdfjs.OPS.transform){transform=pdfjs.Util.transform(transform,args);continue}
  if(operation!==pdfjs.OPS.constructPath)continue;
  const [operators,coordinates]=args,subpaths=[];
  let cursor=0,current=null;
  for(const op of operators){
   if(op===command.moveTo){
    current=[];subpaths.push(current);
    current.push([coordinates[cursor++],coordinates[cursor++]]);
   }else if(op===command.lineTo){
    if(current)current.push([coordinates[cursor],coordinates[cursor+1]]);
    cursor+=2;
   }else if(op===command.curveTo){
    if(current)current.push([coordinates[cursor+4],coordinates[cursor+5]]);
    cursor+=6;
   }else if(op===command.curveTo2||op===command.curveTo3){
    if(current)current.push([coordinates[cursor+2],coordinates[cursor+3]]);
    cursor+=4;
   }else if(op===command.rectangle){
    const [x,y,width,height]=coordinates.slice(cursor,cursor+4);cursor+=4;
    subpaths.push([[x,y],[x+width,y],[x+width,y+height],[x,y+height]]);
    current=null;
   }else if(op===command.closePath&&current){
    current.closed=true;
   }
  }
  for(const subpath of subpaths){
   if(subpath.length<3)continue;
   const points=subpath.map(([x,y])=>{
    const transformed=[transform[0]*x+transform[2]*y+transform[4],transform[1]*x+transform[3]*y+transform[5]];
    const viewportPoint=pdfjs.Util.applyTransform(transformed,viewport.transform);
    return viewportPoint;
   });
   const area=Math.abs(points.reduce((sum,[x,y],pointIndex)=>{
    const [nextX,nextY]=points[(pointIndex+1)%points.length];
    return sum+x*nextY-nextX*y;
   },0))/2;
   if(Number.isFinite(area)&&area>=30&&area<=viewport.width*viewport.height*.3){
    paths.push({points,area});
   }
  }
 }
 return paths;
}

function pointInPolygon(point,points){
 let inside=false;
 for(let i=0,j=points.length-1;i<points.length;j=i++){
  const [x,y]=points[i],[previousX,previousY]=points[j];
  if((y>point[1])!==(previousY>point[1])&&point[0]<(previousX-x)*(point[1]-y)/(previousY-y)+x)inside=!inside;
 }
 return inside;
}

function attachPdfUnitShapes(labels,polygons){
 const centroid=points=>points.reduce((sum,[x,y])=>[sum[0]+x/points.length,sum[1]+y/points.length],[0,0]);
 const used=new Set();
 return labels.map(label=>{
  const point=[label.x,label.y];
  const candidate=polygons.filter(polygon=>!used.has(polygon)&&polygon.area>Math.max(100,label.width*label.height*2)&&pointInPolygon(point,polygon.points))
   .sort((first,second)=>first.area-second.area)[0];
  if(!candidate)return label;
  used.add(candidate);
  return{...label,geometry:{type:'Polygon',coordinates:[candidate.points]}};
 });
}

export function parsePdfLotLabels(textContent,viewport,transformPoint,vectorPolygons=[]){
 const lots=[];
 const areas=[];
 for(const item of textContent.items||[]){
  const text=String(item.str||'').trim();
  const unitMatch=text.match(/^(LOTE|CASA|DEPARTAMENTO|DPTO\.?|DEPTO\.?|OFICINA|UNIDAD)\s+([A-Z0-9-]+)(?:\s+(?:MZ|MANZANA)\s+([A-Z0-9-]+))?$/i);
  const areaMatch=text.match(/^(AREA(?:\s+\(([^)]+)\))?)\s*:\s*([\d.,]+)\s*m(?:2|²)$/i);
  if(!unitMatch&&!areaMatch)continue;
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
  if(unitMatch){
   const [,rawType,identifier,block]=unitMatch;
   const normalizedType=rawType.toUpperCase().startsWith('LOTE')?'Lote':['CASA'].includes(rawType.toUpperCase())?'Casa':'Departamento';
   const prefix=normalizedType==='Lote'?'LOTE':normalizedType==='Casa'?'CASA':'DEPARTAMENTO';
   const code=`${prefix} ${identifier.toUpperCase()}${block?` MZ ${block.toUpperCase()}`:''}`;
   lots.push({number:/^\d+$/.test(identifier)?Number(identifier):null,property_type:normalizedType,block:block?.toUpperCase()||null,code,...position,width:Math.max(width,height),height:Math.min(width,height),areas:[]});
  }
  if(areaMatch){
   const area=Number(areaMatch[3].replace(',','.'));
   if(Number.isFinite(area))areas.push({text,qualifier:areaMatch[2]||'',area,...position});
  }
 }
 for(const area of areas){
  const nearest=lots.map(lot=>({lot,distance:Math.hypot(lot.x-area.x,lot.y-area.y)})).sort((a,b)=>a.distance-b.distance)[0];
  if(nearest&&nearest.distance<=80)nearest.lot.areas.push(area);
 }
 return attachPdfUnitShapes(lots.map(lot=>{
  const uniqueAreas=[...new Map(lot.areas.map(area=>[`${area.qualifier.toLocaleLowerCase('es')}:${area.area}`,area])).values()];
  const clearOfficialArea=uniqueAreas.length===1&&!uniqueAreas[0].qualifier?uniqueAreas[0].area:null;
  const observations=uniqueAreas.length>1
   ?`El plano consigna áreas distintas: ${uniqueAreas.map(area=>`${area.qualifier||'sin calificar'} ${area.area} m²`).join('; ')}. Verificar antes de registrar el área oficial.`
   :uniqueAreas.length===1&&uniqueAreas[0].qualifier
    ?`Área consignada en el plano (${uniqueAreas[0].qualifier}): ${uniqueAreas[0].area} m². Confirmar si corresponde al área oficial.`
    :'';
  return{...lot,area:clearOfficialArea,observations};
 }).sort((a,b)=>comparePropertyCodes(a,b)),vectorPolygons);
}

function propertyColor(status){return PROPERTY_STATUS[status]?.color||'#34C759'}
function propertyArea(unit){
 return numberValue(unit.area_land_m2??unit.area_total_m2??unit.area_covered_m2??unit.other_areas_m2);
}
function defaultType(project){
 if(project.project_type==='Lotes'||project.t==='Lotes')return'Lote';
 if(project.project_type==='Departamentos'||project.t==='Departamentos')return'Departamento';
 return'Casa';
}
export function calculateFinancing({price,initialPercent=30,separation=0,installments=18}){
 const listPrice=Math.max(0,Number(price)||0);
 const percent=Math.min(100,Math.max(0,Number(initialPercent)||0));
 const installmentCount=Math.min(36,Math.max(1,Math.trunc(Number(installments)||1)));
 const finalPrice=listPrice;
 const initialAmount=finalPrice*percent/100;
 const separationAmount=Math.min(initialAmount,Math.max(0,Number(separation)||0));
 const initialDue=Math.max(0,initialAmount-separationAmount);
 const financedAmount=Math.max(0,finalPrice-initialAmount);
 return{listPrice,separationAmount,percent,installmentCount,finalPrice,initialAmount,initialDue,financedAmount,monthlyAmount:financedAmount/installmentCount};
}

export function createPlanWorkspace({getSupabase,getIsAdmin,getUser,getProjects,onSelectProject}){
 const root=document.createElement('section');
 root.id='plans-workspace';
 root.setAttribute('aria-label','Planos interactivos');
 root.innerHTML=`<header class="plans-header"><div><strong>Planos interactivos</strong><span>Selecciona una propiedad o administra su plano</span></div><button type="button" data-action="close">Volver al mapa</button></header>
 <div class="plans-toolbar"><label>Proyecto<select data-field="project"></select></label><label>Plano<select data-field="plan"></select></label><button type="button" data-action="zoom-out" aria-label="Reducir zoom">−</button><input data-field="zoom" type="range" min="0.5" max="4" step="0.1" value="1" aria-label="Zoom del plano"><button type="button" data-action="zoom-in" aria-label="Aumentar zoom">+</button><span data-role="zoom-label">100%</span></div>
 <div class="plans-filter-toolbar" data-role="range-filters" aria-label="Filtros de precio y metraje"></div>
 <p class="plans-status" role="status" aria-live="polite"></p>
 <div class="plans-layout"><aside class="plans-sidebar"><div class="plans-search"><label>Buscar propiedad<input data-field="search" type="search" placeholder="Código, manzana, torre, piso…"></label><label>Estado<select data-field="status-filter"><option value="" selected>Todos los estados</option><option value="available">Disponible</option><option value="reserved">Reservado</option><option value="sold">Vendido</option><option value="blocked">Bloqueado</option></select></label><div data-role="block-filter-slot"></div></div><div class="plans-list" data-role="property-list"></div><div class="plans-admin-tools" data-role="admin-tools"></div></aside><div class="plans-stage"><div class="plans-stage-message" data-role="stage-message">Selecciona un proyecto y plano para comenzar.</div><div class="plans-pan" data-role="pan"><div class="plans-surface" data-role="surface"><canvas data-role="pdf-canvas"></canvas><svg data-role="plan-svg" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Plano interactivo"></svg></div></div><div class="plans-map-tools" data-role="map-tools"></div></div><aside class="plans-inspector" data-role="inspector"><h2>Ficha de propiedad</h2><p>Elige una figura del plano para consultar sus datos.</p></aside></div>`;
 document.body.append(root);

 const $=selector=>root.querySelector(selector);
 const state={open:false,projectId:'',planId:'',selectedPlanByProject:new Map(),projectLoadSequence:0,plans:[],units:[],selectedId:'',scene:null,zoom:1,panX:0,panY:0,drag:null,loadingPlan:false,refreshTimer:null,pdfDocument:null,quoteModes:new Map(),quoteValues:new Map(),statusFilter:'available',blockFilter:''};
 const statusMessage=text=>{$('.plans-status').textContent=text||''};
 const planById=()=>state.plans.find(plan=>plan.id===state.planId)||null;
 const projectById=()=>getProjects().find(project=>project.id===state.projectId)||null;
 const selectedUnit=()=>state.units.find(unit=>unit.id===state.selectedId)||null;
 const publicPlanUrl=plan=>getSupabase().storage.from(BUCKET).getPublicUrl(plan.file_path).data.publicUrl;
 const formatPrice=price=>price==null?'Consultar':`S/ ${Number(price).toLocaleString('es-PE',{minimumFractionDigits:Number.isInteger(Number(price))?0:2,maximumFractionDigits:2})}`;
 const quoteKey=unit=>unit.id||`draft:${unit.project_id}:${unit.code}`;
 const quoteValues=unit=>{
  const key=quoteKey(unit);
  if(!state.quoteValues.has(key)){
   const now=new Date(),date=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);
   state.quoteValues.set(key,{initialPercent:null,installments:null,separation:0,initialDate:date});
  }
  return state.quoteValues.get(key);
 };

 function initializeSelectors(){
  const projectSelect=$('[data-field="project"]');
  projectSelect.innerHTML=getProjects().filter(project=>['Lotes','Departamentos','Casas','Casa de campo'].includes(project.t)).map(project=>`<option value="${attr(project.id)}">${attr(project.n)}</option>`).join('');
  state.projectId=projectSelect.value||'';
  projectSelect.onchange=()=>{
   if(state.projectId&&state.planId)state.selectedPlanByProject.set(state.projectId,state.planId);
   state.projectId=projectSelect.value;
   state.planId=state.selectedPlanByProject.get(state.projectId)||'';
   state.selectedId='';state.scene=null;
   loadProjectData();
  };
  $('[data-field="plan"]').onchange=()=>{
   state.planId=$('[data-field="plan"]').value;
   if(state.projectId&&state.planId)state.selectedPlanByProject.set(state.projectId,state.planId);
   state.selectedId='';state.blockFilter='';loadPlanScene();
  };
  $('[data-field="search"]').oninput=renderPropertyList;
  $('[data-field="status-filter"]').value=state.statusFilter;
  $('[data-field="status-filter"]').onchange=event=>{state.statusFilter=event.target.value;renderPropertyList()};
  const rangeFilters=$('[data-role="range-filters"]');
  rangeFilters.addEventListener('input',handleRangeInput);
  rangeFilters.addEventListener('pointerdown',event=>{
   const input=event.target.closest('[data-range]');
   if(input)input.style.zIndex='4';
  });
  rangeFilters.addEventListener('pointerup',()=>rangeFilters.querySelectorAll('[data-range]').forEach(input=>input.style.removeProperty('z-index')));
  rangeFilters.addEventListener('pointercancel',()=>rangeFilters.querySelectorAll('[data-range]').forEach(input=>input.style.removeProperty('z-index')));
  $('[data-field="zoom"]').oninput=()=>setZoom(Number($('[data-field="zoom"]').value));
  $('[data-action="close"]').onclick=close;
  $('[data-action="zoom-out"]').onclick=()=>setZoom(state.zoom-.2);
  $('[data-action="zoom-in"]').onclick=()=>setZoom(state.zoom+.2);
  $('[data-role="pan"]').addEventListener('wheel',event=>{event.preventDefault();setZoom(state.zoom+(event.deltaY<0?.15:-.15))},{passive:false});
  bindPan();
 }

 async function open(projectId=''){
  if(projectId&&getProjects().some(project=>project.id===projectId)){
   const projectChanged=state.projectId!==projectId;
   state.projectId=projectId;
   $('[data-field="project"]').value=projectId;
   state.planId=state.selectedPlanByProject.get(projectId)||'';
   if(projectChanged)state.blockFilter='';
  }
  state.open=true;
  root.classList.add('open');
  document.body.classList.add('plans-open');
  $('[data-field="status-filter"]').value=state.statusFilter='available';
  statusMessage('');
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
  const databaseUnits=(unitResult.data||[]).map(unit=>unit.status==='unknown'?{...unit,status:'available'}:unit);
  const databaseKeys=new Set(databaseUnits.map(unit=>`${unit.plan_id}:${unit.property_type}:${unit.code}`));
  const previews=state.units.filter(unit=>String(unit.id).startsWith('preview:')&&!databaseKeys.has(`${unit.plan_id}:${unit.property_type}:${unit.code}`));
  state.units=[...databaseUnits,...previews].sort(comparePropertyCodes);
  renderPlanOptions();
  renderRangeFilters();
  renderPropertyList();
  renderInspector();
  renderSvg();
  renderMapTools();
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
  renderPropertyList();
  renderInspector();
  if(!plan){
   $('.plans-surface').hidden=true;
   $('.plans-stage-message').hidden=false;
   $('.plans-stage-message').textContent='Selecciona un plano para visualizar sus propiedades.';
   renderMapTools();
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
   if(plan.source_type==='pdf'){
    const imported=await syncPdfUnits(plan,projectById());
    if(imported&&getIsAdmin())statusMessage(`Se detectaron y sincronizaron ${imported} unidades desde el PDF.`);
   }
   state.loadingPlan=false;
   renderSvg();
   renderMapTools();
   renderPropertyList();
   if(plan.source_width!==state.scene.width||plan.source_height!==state.scene.height){
    if(getIsAdmin()){
     const {error}=await getSupabase().from('property_plans').update({source_width:state.scene.width,source_height:state.scene.height}).eq('id',plan.id);
     if(error)statusMessage(`El plano se visualizó, pero no se guardaron sus dimensiones: ${error.message}`);
     else{plan.source_width=state.scene.width;plan.source_height=state.scene.height}
    }
   }
   if(isHuertasSicayaPlan(projectById(),plan)){
    try{await importHuertasSicayaLots()}
    catch(error){statusMessage(`El plano se abrió, pero no se pudieron importar los lotes: ${error.message}`)}
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
  const operatorList=await page.getOperatorList();
  const vectorPolygons=parsePdfVectorPolygons(operatorList,viewport,pdfjs);
  const labels=parsePdfLotLabels(textContent,viewport,pdfjs.Util.transform,vectorPolygons);
  const sicayaLots=isHuertasSicayaPlan(projectById(),plan)?matchHuertasSicayaPdfLots(vectorPolygons):[];
  const canvas=$('[data-role="pdf-canvas"]'),context=canvas.getContext('2d');
  const scale=Math.min(2.5,2000/Math.max(viewport.width,viewport.height));
  const rendered=page.getViewport({scale});
  canvas.width=Math.ceil(rendered.width);
  canvas.height=Math.ceil(rendered.height);
  canvas.style.aspectRatio=`${viewport.width}/${viewport.height}`;
  await page.render({canvasContext:context,viewport:rendered}).promise;
  state.scene={width:viewport.width,height:viewport.height,background:'pdf',polygons:vectorPolygons,labels,sicayaLots};
  canvas.hidden=false;
 }
 async function syncPdfUnits(plan,project){
  if(!project||!state.scene?.labels?.length)return 0;
  const isAdmin=getIsAdmin();
  const labels=state.scene.labels.filter(label=>label.code&&label.x>=0&&label.y>=0&&label.x<=state.scene.width&&label.y<=state.scene.height);
  if(!labels.length)return 0;
  const changed=[],records=[],previews=[];
  for(const label of labels){
   const existing=state.units.find(unit=>unit.plan_id===plan.id&&unit.property_type===label.property_type&&unit.code===label.code);
   const geometry=label.geometry||{type:'Point',coordinates:[label.x,label.y]};
   const officialLot=project.id==='las-huertas-de-sicaya'&&label.property_type==='Lote'
    ?HUERTAS_SICAYA_LOTS.find(lot=>lot.number===label.number&&(!label.block||lot.block===label.block))
    :null;
   if(!existing){
    const record={project_id:project.id,plan_id:plan.id,property_type:label.property_type,code:label.code,block:label.block||officialLot?.block||null,area_land_m2:officialLot?.area??label.area,status:officialLot?.status||'available',price:officialLot?.price??null,observations:label.observations||null,geometry};
    if(isAdmin)records.push({...record,created_by:getUser()?.id||null});
    else previews.push({...record,id:`preview:${plan.id}:${label.code}`});
    continue;
   }
   const geometryNeedsUpdate=JSON.stringify(existing.geometry)!==JSON.stringify(geometry);
   const record={};
   if(geometryNeedsUpdate)record.geometry=geometry;
   if(existing.area_land_m2==null&&(officialLot?.area??label.area)!=null)record.area_land_m2=officialLot?.area??label.area;
   if(!existing.block&&(label.block||officialLot?.block))record.block=label.block||officialLot.block;
   if(existing.price==null&&officialLot)record.price=officialLot.price;
   if(existing.status==null&&officialLot)record.status=officialLot.status;
   if(isAdmin&&Object.keys(record).length)changed.push({unit:existing,record});
   else if(!isAdmin)Object.assign(existing,record);
  }
  const updates=isAdmin?await Promise.all(changed.map(async({unit,record})=>{
   const {data,error}=await getSupabase().from('property_units').update(record).eq('id',unit.id).select().single();
   if(error)throw new Error(`No se pudo actualizar ${unit.code} desde el PDF: ${error.message}`);
   return data;
  })):[];
  let inserted=[];
  if(isAdmin&&records.length){
   const {data,error}=await getSupabase().from('property_units').insert(records).select();
   if(error)throw new Error(`No se pudieron guardar las unidades detectadas en el PDF: ${error.message}`);
   inserted=data||[];
  }
  for(const unit of [...updates,...inserted,...previews]){
   state.units=state.units.filter(existing=>existing.id!==unit.id);
   state.units.push(unit);
  }
  if(updates.length||inserted.length)renderRangeFilters();
  return updates.length+inserted.length+previews.length;
 }
 async function renderDxf(plan){
  const response=await fetch(publicPlanUrl(plan));
  if(!response.ok)throw new Error(`El archivo DXF no pudo descargarse (HTTP ${response.status}).`);
  const scene=parseDxf(await response.text());
  if(isHuertasSicayaPlan(projectById(),plan)){
   const lots=matchHuertasSicayaLots(scene);
   scene.huertasLotCount=lots.length;
   if(lots.length===HUERTAS_SICAYA_LOTS.length){
    const points=lots.flatMap(({polygon})=>polygon.points);
    const xs=points.map(([x])=>x),ys=points.map(([,y])=>y),padding=18;
    const left=Math.max(0,Math.min(...xs)-padding),top=Math.max(0,Math.min(...ys)-padding);
    const right=Math.min(scene.width,Math.max(...xs)+padding),bottom=Math.min(scene.height,Math.max(...ys)+padding);
    scene.viewBox={x:left,y:top,width:right-left,height:bottom-top};
   }
  }
  state.scene={...scene,background:'dxf'};
  $('[data-role="pdf-canvas"]').hidden=true;
  }

 function rangeDomain(type){
  const step=type==='price'?1000:1;
  const values=state.units.filter(unit=>unit.project_id===state.projectId).map(unit=>type==='price'?numberValue(unit.price):propertyArea(unit)).filter(value=>value!==null&&Number.isFinite(value));
  if(!values.length)return{min:0,max:step,step,disabled:true};
  const min=Math.floor(Math.min(...values)/step)*step;
  let max=Math.ceil(Math.max(...values)/step)*step;
  if(min===max)max+=step;
  return{min,max,step,disabled:false};
 }
 function formatRangeValue(type,value){
  return type==='price'?`S/ ${Number(value).toLocaleString('es-PE')}`:`${Number(value).toLocaleString('es-PE',{maximumFractionDigits:2})} m²`;
 }
 function renderRangeFilters(){
  const container=$('[data-role="range-filters"]');
  const controls=['price','area'].map(type=>{
   const domain=rangeDomain(type),label=type==='price'?'Precio':'Metraje',minLabel=type==='price'?'Precio mínimo':'Área mínima',maxLabel=type==='price'?'Precio máximo':'Área máxima';
   const previousMin=container.querySelector(`[data-range="${type}-min"]`),previousMax=container.querySelector(`[data-range="${type}-max"]`);
   let min=domain.min,max=domain.max;
   if(previousMin&&previousMax&&!domain.disabled){
    const wasActive=Number(previousMin.value)>Number(previousMin.min)||Number(previousMax.value)<Number(previousMax.max);
    if(wasActive){
     min=Math.max(domain.min,Math.min(domain.max,Number(previousMin.value)));
     max=Math.max(min,Math.min(domain.max,Number(previousMax.value)));
    }
   }
   return `<section class="plans-range-control"><strong>${label}</strong><output data-range-output="${type}" aria-live="polite">${formatRangeValue(type,min)} – ${formatRangeValue(type,max)}</output><div class="plans-range-sliders" data-range-track="${type}"><input type="range" data-range="${type}-min" min="${domain.min}" max="${domain.max}" step="${domain.step}" value="${min}" aria-label="${minLabel}" ${domain.disabled?'disabled':''}><input type="range" data-range="${type}-max" min="${domain.min}" max="${domain.max}" step="${domain.step}" value="${max}" aria-label="${maxLabel}" ${domain.disabled?'disabled':''}></div></section>`;
  }).join('');
  container.innerHTML=`<div class="plans-range-bar">${controls}</div>`;
  ['price','area'].forEach(updateRangeOutput);
 }
 function updateRangeOutput(type){
  const minimum=$(`[data-range="${type}-min"]`),maximum=$(`[data-range="${type}-max"]`),output=$(`[data-range-output="${type}"]`);
  if(minimum&&maximum&&output){
   output.textContent=`${formatRangeValue(type,minimum.value)} – ${formatRangeValue(type,maximum.value)}`;
   const min=Number(minimum.min),max=Number(minimum.max),span=max-min||1;
   const track=$(`[data-range-track="${type}"]`);
   track?.style.setProperty('--range-start',`${(Number(minimum.value)-min)/span*100}%`);
   track?.style.setProperty('--range-end',`${(Number(maximum.value)-min)/span*100}%`);
  }
 }
 function handleRangeInput(event){
  const input=event.target.closest('[data-range]');
  if(!input)return;
  const [type,bound]=input.dataset.range.split('-');
  const minimum=$(`[data-range="${type}-min"]`),maximum=$(`[data-range="${type}-max"]`);
  if(bound==='min'&&Number(minimum.value)>Number(maximum.value))minimum.value=maximum.value;
  if(bound==='max'&&Number(maximum.value)<Number(minimum.value))maximum.value=minimum.value;
  updateRangeOutput(type);
  renderPropertyList();
 }
 function activeRange(type){
  const domain=rangeDomain(type),minimum=$(`[data-range="${type}-min"]`),maximum=$(`[data-range="${type}-max"]`);
  if(!minimum||!maximum)return{active:false,min:domain.min,max:domain.max};
  const min=Number(minimum.value),max=Number(maximum.value);
  return{active:min>domain.min||max<domain.max,min,max};
 }
 function filteredPlanUnits(){
  const query=$('[data-field="search"]').value.trim().toLocaleLowerCase('es'),status=state.statusFilter;
  const priceRange=activeRange('price'),areaRange=activeRange('area');
  return state.units.filter(unit=>{
   if(unit.plan_id!==state.planId||(status&&unit.status!==status))return false;
   if(state.blockFilter&&String(unit.block||'')!==state.blockFilter)return false;
   const area=propertyArea(unit),price=numberValue(unit.price);
   if(priceRange.active&&(price===null||price<priceRange.min||price>priceRange.max))return false;
   if(areaRange.active&&(area===null||area<areaRange.min||area>areaRange.max))return false;
   return !query||[
   unit.code,unit.block,unit.address,unit.location_label,unit.building,unit.tower,unit.floor_label,unit.property_type
   ].some(value=>String(value||'').toLocaleLowerCase('es').includes(query));
  }).sort(comparePropertyCodes);
 }
 function renderPropertyList(){
  const blockSlot=$('[data-role="block-filter-slot"]');
  const blocks=[...new Set(state.units.filter(unit=>unit.plan_id===state.planId&&unit.block).map(unit=>String(unit.block)))].sort((a,b)=>a.localeCompare(b,'es',{numeric:true}));
  if(blocks.length){
   const selected=blocks.includes(state.blockFilter)?state.blockFilter:'';
   state.blockFilter=selected;
   blockSlot.innerHTML=`<label>Manzana<select data-field="block-filter"><option value="">Todas las manzanas</option>${blocks.map(block=>`<option value="${attr(block)}" ${block===selected?'selected':''}>Manzana ${attr(block)}</option>`).join('')}</select></label>`;
   blockSlot.querySelector('[data-field="block-filter"]').onchange=event=>{state.blockFilter=event.target.value;renderPropertyList()};
  }else{
   state.blockFilter='';
   blockSlot.innerHTML='';
  }
  const visible=filteredPlanUnits();
  const emptyMessage=state.units.some(unit=>unit.plan_id===state.planId)
   ?'No hay propiedades que coincidan con los filtros seleccionados.'
   :state.projectId==='las-huertas-de-sicaya'
    ?'No hay unidades cargadas para este plano. Carga el plano PDF o DXF de lotización para asociar los 14 lotes.'
    :'No hay unidades cargadas para este plano.';
  $('[data-role="property-list"]').innerHTML=visible.length?visible.map(unit=>`<button type="button" class="plan-property ${unit.id===state.selectedId?'selected':''}" data-unit-id="${attr(unit.id)}"><i style="--property-color:${propertyColor(unit.status)}"></i><span><b>${attr(unit.code)}</b><small>${attr(unit.block?`Mz. ${unit.block} · `:'')}${attr(unit.floor_label||unit.tower||unit.property_type)} · ${attr(PROPERTY_STATUS[unit.status]?.label||unit.status)}</small></span></button>`).join(''):`<p class="plans-empty">${emptyMessage}</p>`;
  $('[data-role="property-list"]').querySelectorAll('[data-unit-id]').forEach(button=>button.onclick=()=>selectUnit(button.dataset.unitId));
  renderSvg();
 }
 function selectUnit(id){
  state.selectedId=id;
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
  container.innerHTML=`<details><summary>Agregar plano PDF/DXF</summary><form data-form="upload-plan"><label>Nombre del plano<input name="name" maxlength="100" placeholder="Ej. Plano de lotización" required></label><label>Piso / torre (opcional)<input name="floor" maxlength="80" placeholder="Ej. Torre A · Piso 3"></label><label>Página PDF<input name="page_number" type="number" min="1" step="1" value="1"></label><label>Archivo PDF o DXF<input name="file" type="file" accept=".pdf,.dxf,application/pdf,application/dxf" required></label><p class="plans-note">DWG: expórtalo a DXF antes de cargarlo. El plano queda almacenado en Supabase.</p><button type="submit" ${supported?'':'disabled'}>Subir plano</button></form></details>${state.planId?'<button type="button" data-action="delete-plan" class="danger">Eliminar plano y sus propiedades</button>':''}`;
  const form=container.querySelector('[data-form="upload-plan"]');
  form.onsubmit=event=>uploadPlan(event).catch(error=>statusMessage(error.message));
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
  const uploadFile=sourceType==='dxf'&&file.type!==mimeType?new File([file],file.name,{type:mimeType}):file;
  const path=`plans/${project.id}/${crypto.randomUUID()}-${slug(file.name)}`;
  statusMessage('Subiendo plano…');
  const {data:stored,error:uploadError}=await getSupabase().storage.from(BUCKET).upload(path,uploadFile,{contentType:mimeType,upsert:false});
  if(uploadError)throw new Error(`No se pudo subir el plano: ${uploadError.message}`);
  const pageNumber=Number(form.elements.page_number.value||1);
  const existingPlan=project.id==='joya-verde'?state.plans.find(plan=>plan.project_id===project.id&&plan.source_type==='pdf'):null;
  const planData={project_id:project.id,name:form.elements.name.value.trim()||existingPlan?.name||file.name,floor_label:form.elements.floor.value.trim()||existingPlan?.floor_label||null,source_type:sourceType,file_path:stored.path,file_name:file.name,page_number:sourceType==='pdf'?pageNumber:1};
  const response=existingPlan
   ?await getSupabase().from('property_plans').update(planData).eq('id',existingPlan.id).select().single()
   :await getSupabase().from('property_plans').insert({...planData,created_by:getUser()?.id||null}).select().single();
  const {data,error}=response;
  if(error){
   const {error:cleanupError}=await getSupabase().storage.from(BUCKET).remove([stored.path]);
   throw new Error(`No se pudo guardar el plano: ${error.message}${cleanupError?` No se pudo limpiar el archivo subido: ${cleanupError.message}`:''}`);
  }
  if(existingPlan){
   state.plans=state.plans.map(plan=>plan.id===data.id?data:plan);
   const {error:cleanupError}=await getSupabase().storage.from(BUCKET).remove([existingPlan.file_path]);
   if(cleanupError)statusMessage(`El nuevo plano se guardó, pero no se pudo eliminar el PDF anterior: ${cleanupError.message}`);
  }else state.plans.push(data);
  state.planId=data.id;
  state.selectedPlanByProject.set(project.id,data.id);
  renderPlanOptions();
  state.zoom=1;state.panX=0;state.panY=0;
  setZoom(1);
  statusMessage('Plano guardado en Supabase.');
  await loadPlanScene();
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
  renderPlanOptions();renderRangeFilters();renderPropertyList();renderInspector();
  await loadPlanScene();
  statusMessage(storageError?`El plano y sus propiedades se eliminaron, pero no se pudo borrar el archivo almacenado: ${storageError.message}`:'Plano y propiedades eliminados.');
 }
 function renderInspector(){
  const container=$('[data-role="inspector"]');
  const unit=selectedUnit();
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
  container.innerHTML=`<h2>${unit.id?'Propiedad':'Nueva propiedad'}</h2><p class="plans-property-kind">${attr(unit.property_type)} · ${attr(planById()?.name||'')}</p><form data-form="property">${fields.join('')}${editable?`<div class="plans-edit-actions"><button type="submit">Guardar cambios</button>${unit.id?'<button type="button" data-action="delete" class="danger">Eliminar</button>':''}</div>`:''}</form>${renderFinancing(unit)}`;
  const form=container.querySelector('[data-form="property"]');
  if(editable){
   form.onsubmit=event=>saveProperty(event).catch(error=>statusMessage(`No se pudieron guardar los cambios: ${error.message}`));
   form.querySelector('[name="status"]').onchange=()=>{updateDraftFromForm(form);renderPropertyList();renderSvg()};
   form.querySelector('[name="property_type"]').onchange=()=>{updateDraftFromForm(form);renderInspector()};
   form.querySelector('[data-action="delete"]')?.addEventListener('click',()=>deleteProperty().catch(error=>statusMessage(`No se pudo eliminar la propiedad: ${error.message}`)));
  }
  container.querySelectorAll('[data-quote-field]').forEach(input=>input.addEventListener('input',()=>{
   const values=quoteValues(unit);
   values[input.dataset.quoteField]=input.type==='number'?numberValue(input.value):input.value;
   renderFinanceSummary(container,unit);
  }));
  container.querySelectorAll('[data-quote-mode]').forEach(button=>button.addEventListener('click',()=>{
   state.quoteModes.set(quoteKey(unit),button.dataset.quoteMode);
   renderInspector();
  }));
  container.querySelector('[data-action="download-quote-pdf"]')?.addEventListener('click',()=>{
   try{downloadQuotePdf(unit)}
   catch(error){statusMessage(`No se pudo preparar el cronograma PDF: ${error.message}`)}
  });
  renderFinanceSummary(container,unit);
 }
 function renderFinancing(unit){
  const values=quoteValues(unit),mode=state.quoteModes.get(quoteKey(unit))||'financed';
  return `<section class="unit-financing"><div class="quote-tabs"><button type="button" data-quote-mode="cash" class="${mode==='cash'?'active':''}">Contado</button><button type="button" data-quote-mode="financed" class="${mode==='financed'?'active':''}">Financiado</button></div><div data-role="quote-content" ${mode==='cash'?'hidden':''}><p class="quote-list-price">Precio de lista <strong>${attr(formatPrice(unit.price))}</strong></p><p class="quote-note">Financiamiento referencial sin descuento ni intereses.</p><label>Inicial (%) <input data-quote-field="initialPercent" type="number" min="0" max="100" step="1" value="${attr(values.initialPercent??'')}" placeholder="Ingresa el porcentaje"></label><p class="quote-hint">Ingresa el porcentaje acordado.</p><label>N.º de cuotas (máximo 36) <input data-quote-field="installments" type="number" min="1" max="36" step="1" value="${attr(values.installments??'')}" placeholder="Ingresa la cantidad"></label><label>Fecha de pago de la inicial <input data-quote-field="initialDate" type="date" value="${attr(values.initialDate)}"></label><label>Separación (S/) <input data-quote-field="separation" type="number" min="0" max="${attr(unit.price??0)}" step="100" value="${attr(values.separation)}"></label><div class="quote-totals"><p>Inicial requerida <strong data-quote-result="initial-percent"></strong></p><p>Separación abonada <strong data-quote-result="separation"></strong></p><p>Saldo de inicial <strong data-quote-result="initial"></strong></p><p>Precio final <strong data-quote-result="final-price"></strong></p><p>Monto a financiar <strong data-quote-result="financed"></strong></p></div><p class="quote-monthly"><span data-quote-result="monthly-title"></span><strong data-quote-result="monthly"></strong></p><p class="quote-note">Cálculo referencial. Verifica las condiciones con un asesor.</p><div class="quote-schedule"><strong>Cronograma de pagos</strong><table><thead><tr><th>Cuota</th><th>Fecha</th><th>Monto</th><th>Saldo</th></tr></thead><tbody data-role="quote-schedule"></tbody></table><button type="button" data-action="download-quote-pdf" disabled>Descargar cronograma en PDF</button></div></div><div data-role="quote-cash" ${mode==='cash'?'':'hidden'}><p class="quote-list-price">Precio de contado <strong>${attr(formatPrice(unit.price))}</strong></p><p class="quote-note">Pago único. Confirma el precio vigente con un asesor.</p></div></section>`;
 }
 function paymentSchedule(values,quote){
  const date=new Date(`${values.initialDate||new Date().toISOString().slice(0,10)}T12:00:00`);
  const rows=[{label:'Saldo de inicial',date:date.toLocaleDateString('es-PE'),amount:quote.initialDue,balance:quote.financedAmount}];
  for(let index=0;index<quote.installmentCount;index++){
   const due=new Date(date),day=date.getDate();
   due.setDate(1);due.setMonth(due.getMonth()+index+1);
   due.setDate(Math.min(day,new Date(due.getFullYear(),due.getMonth()+1,0).getDate()));
   rows.push({label:`Cuota ${index+1}`,date:due.toLocaleDateString('es-PE'),amount:quote.monthlyAmount,balance:Math.max(0,quote.financedAmount-quote.monthlyAmount*(index+1))});
  }
  return rows;
 }
 function renderFinanceSummary(container,unit){
  const values=quoteValues(unit),quote=calculateFinancing({price:unit.price,initialPercent:values.initialPercent,separation:values.separation,installments:values.installments});
  const result=(name,value)=>{const target=container.querySelector(`[data-quote-result="${name}"]`);if(target)target.textContent=value};
  const invalidPrice=unit.price==null||!Number.isFinite(Number(unit.price));
  const hasSchedule=values.initialPercent!==null&&Number(values.initialPercent)>=0&&Number(values.initialPercent)<=100&&values.installments!==null&&Number.isInteger(Number(values.installments))&&Number(values.installments)>=1&&Number(values.installments)<=36;
  const showAmount=amount=>invalidPrice?'Consultar':formatPrice(amount);
  result('initial',values.initialPercent===null?'—':showAmount(quote.initialDue));
  result('initial-percent',values.initialPercent===null?'—':`${quote.percent}% · ${showAmount(quote.initialAmount)}`);
  result('separation',showAmount(quote.separationAmount));
  result('final-price',showAmount(quote.finalPrice));
  result('financed',showAmount(quote.financedAmount));
  result('monthly-title',hasSchedule?`Cuota mensual (× ${quote.installmentCount})`:'Completa el número de cuotas');
  result('monthly',hasSchedule?showAmount(quote.monthlyAmount):'—');
  container.querySelector('[data-quote-field="separation"]')?.setAttribute('max',String(quote.initialAmount));
  const schedule=container.querySelector('[data-role="quote-schedule"]');
  if(!schedule)return;
  const rows=hasSchedule?paymentSchedule(values,quote):[];
  schedule.innerHTML=invalidPrice?'<tr><td colspan="4">Precio pendiente de registro</td></tr>':hasSchedule?rows.map(row=>`<tr><td>${attr(row.label)}</td><td>${attr(row.date)}</td><td>${attr(formatPrice(row.amount))}</td><td>${attr(formatPrice(row.balance))}</td></tr>`).join(''):'<tr><td colspan="4">Ingresa la inicial y el número de cuotas para calcular el cronograma.</td></tr>';
  const downloadButton=container.querySelector('[data-action="download-quote-pdf"]');
  if(downloadButton)downloadButton.disabled=!hasSchedule||invalidPrice;
  container.querySelectorAll('[data-quote-field="installments"]').forEach(input=>input.setCustomValidity(input.value!==''&&(!Number.isInteger(Number(input.value))||Number(input.value)<1||Number(input.value)>36)?'Ingresa entre 1 y 36 cuotas enteras.':''));
  container.querySelectorAll('[data-quote-field="initialPercent"]').forEach(input=>input.setCustomValidity(input.value!==''&&(Number(input.value)<0||Number(input.value)>100)?'Ingresa un porcentaje entre 0 y 100.':''));
 }
 function downloadQuotePdf(unit){
  const values=quoteValues(unit),project=projectById();
  if(!project)throw new Error('No se encontró el proyecto de la propiedad.');
  if(values.initialPercent===null||values.installments===null||!Number.isInteger(Number(values.installments))||Number(values.installments)<1||Number(values.installments)>36)throw new Error('Completa la inicial y un número de 1 a 36 cuotas.');
  if(unit.price==null||!Number.isFinite(Number(unit.price)))throw new Error('Registra el precio de la propiedad antes de generar el cronograma.');
  const quote=calculateFinancing({price:unit.price,initialPercent:values.initialPercent,separation:values.separation,installments:values.installments});
  const rows=paymentSchedule(values,quote);
  const area=propertyArea(unit);
  const details=[
   ['Proyecto',project.n],
   ['Ubicación',[project.d,project.loc].filter(Boolean).join(' · ')],
   ['Propiedad',[unit.code,unit.property_type,unit.block?`Manzana ${unit.block}`:'',unit.tower?`Torre ${unit.tower}`:'',unit.floor_label?`Piso ${unit.floor_label}`:''].filter(Boolean).join(' · ')],
   ['Área',area===null?'No registrada':`${area.toLocaleString('es-PE',{maximumFractionDigits:2})} m²`],
   ['Precio de lista',formatPrice(quote.listPrice)],
   ['Inicial',`${quote.percent}% · ${formatPrice(quote.initialAmount)}`],
   ['Separación abonada',formatPrice(quote.separationAmount)],
   ['Fecha de pago de la inicial',new Date(`${values.initialDate||new Date().toISOString().slice(0,10)}T12:00:00`).toLocaleDateString('es-PE')],
   ['Monto a financiar',formatPrice(quote.financedAmount)]
  ];
  const title=`HABITAT INMOBILIARIA - CRONOGRAMA DE PAGOS - ${project.n} - ${unit.code}`;
  const printWindow=window.open('','_blank');
  if(!printWindow)throw new Error('El navegador bloqueó la ventana del cronograma. Permite ventanas emergentes e inténtalo nuevamente.');
  printWindow.opener=null;
  printWindow.document.open();
  printWindow.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${attr(title)}</title><style>@page{size:A4;margin:18mm}*{box-sizing:border-box}body{font:12px Arial,sans-serif;color:#1d2b2f}h1{margin:0;color:#1d2b2f;font-size:23px}h2{margin:4px 0 20px;color:#5e6e70;font-size:14px;font-weight:500}.brand{padding-bottom:12px;border-bottom:3px solid #2f8f6b}.details{display:grid;grid-template-columns:1fr 1fr;gap:8px 20px;margin:18px 0 24px}.details p{margin:0;padding:8px 0;border-bottom:1px solid #d3d9d3}.details strong{display:block;margin-bottom:3px;color:#5e6e70;font-size:10px;text-transform:uppercase}table{width:100%;border-collapse:collapse}th,td{padding:8px 6px;border-bottom:1px solid #d3d9d3;text-align:left}th{background:#eef0ec}td:nth-child(n+3),th:nth-child(n+3){text-align:right}.note{margin-top:18px;color:#5e6e70;font-size:10px}@media print{button{display:none}}</style></head><body><div class="brand"><h1>HABITAT INMOBILIARIA</h1><h2>Cronograma de pagos</h2></div><section class="details">${details.map(([label,value])=>`<p><strong>${attr(label)}</strong>${attr(value)}</p>`).join('')}</section><table><thead><tr><th>Cuota</th><th>Fecha</th><th>Monto</th><th>Saldo</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${attr(row.label)}</td><td>${attr(row.date)}</td><td>${attr(formatPrice(row.amount))}</td><td>${attr(formatPrice(row.balance))}</td></tr>`).join('')}</tbody></table><p class="note">Cálculo referencial sin intereses. Confirma las condiciones vigentes con un asesor de HABITAT INMOBILIARIA.</p></body></html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  statusMessage('En el diálogo de impresión, elige “Guardar como PDF” para descargar el cronograma.');
 }
 function updateDraftFromForm(form){
  const data=new FormData(form),unit=selectedUnit();
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
  const form=event.currentTarget,unit=selectedUnit();
  updateDraftFromForm(form);
  if(!unit?.code.trim())return statusMessage('El código de la propiedad es obligatorio.');
  const coordinates=unit.geometry?.coordinates;
  const hasPolygon=unit.geometry?.type==='Polygon'&&Array.isArray(coordinates?.[0])&&coordinates[0].length>=3;
  const hasPoint=unit.geometry?.type==='Point'&&Array.isArray(coordinates)&&coordinates.length===2&&coordinates.every(Number.isFinite);
  if(!hasPolygon&&!hasPoint)return statusMessage('La unidad no tiene geometría detectada en el plano; carga un PDF o DXF con su contorno para poder guardarla.');
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
  renderRangeFilters();
  renderPropertyList();renderSvg();renderInspector();
  renderPropertyList();
  renderInspector();
  renderSvg();
  statusMessage('Propiedad y geometría guardadas en Supabase.');
 }
 async function deleteProperty(){
  const unit=selectedUnit();
  if(!unit||!getIsAdmin()||!window.confirm(`¿Eliminar permanentemente la propiedad ${unit.code}?`))return;
  const {error}=await getSupabase().from('property_units').delete().eq('id',unit.id);
  if(error){statusMessage(`No se pudo eliminar la propiedad: ${error.message}`);return}
  state.units=state.units.filter(item=>item.id!==unit.id);
  state.selectedId='';
  renderRangeFilters();
  renderPropertyList();
  renderInspector();
  renderSvg();
  statusMessage('Propiedad eliminada.');
 }

 function renderSvg(){
  const svg=$('[data-role="plan-svg"]');
  if(!state.scene){svg.replaceChildren();return}
  const viewport=sceneViewport(state.scene);
  svg.setAttribute('viewBox',`${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`);
  const dxfLabels=state.scene.background==='dxf'?state.scene.labels.filter(label=>(/^\d+$/.test(label.text)&&label.layer==='VIVIENDA')||(/^[AB]$/i.test(label.text)&&label.layer==='MANZANAS')).map(label=>`<text x="${label.position[0]}" y="${label.position[1]}" text-anchor="middle" dominant-baseline="central">${attr(label.text)}</text>`).join(''):'';
  const visibleUnits=filteredPlanUnits();
  svg.innerHTML=`${state.scene.background==='dxf'?`<g class="dxf-background">${state.scene.paths}</g><g class="dxf-labels">${dxfLabels}</g>`:''}<g class="property-shapes">${visibleUnits.map(renderPropertyShape).join('')}</g><g class="property-labels">${visibleUnits.map(renderPropertyLabel).join('')}</g>`;
  svg.querySelectorAll('[data-property-id]').forEach(shape=>shape.onclick=event=>{
   event.stopPropagation();
   selectUnit(shape.dataset.propertyId);
  });
  svg.querySelectorAll('[data-property-id]').forEach(shape=>shape.onkeydown=event=>{
   if(event.key==='Enter'||event.key===' '){
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
  const id=unit.id||'draft';
  return `<g class="plan-unit ${selected?'selected':''}" data-property-id="${attr(id)}" tabindex="0" role="button" aria-label="${attr(unit.code)} · ${attr(PROPERTY_STATUS[unit.status]?.label||unit.status)}"><polygon points="${points.map(point=>point.map(Number).join(',')).join(' ')}" fill="${color}" fill-opacity="${selected?'.72':'.52'}" stroke="none"></polygon></g>`;
 }
 function renderPropertyShape(unit){
  if(unit.geometry?.type==='Point'&&Array.isArray(unit.geometry.coordinates)&&unit.geometry.coordinates.length===2){
   const [x,y]=unit.geometry.coordinates.map(Number),radius=Math.max(14,Math.max(state.scene.width,state.scene.height)*.012);
   return `<g class="plan-unit" data-property-id="${attr(unit.id)}" tabindex="0" role="button" aria-label="${attr(unit.code)} · ${attr(PROPERTY_STATUS[unit.status]?.label||unit.status)}"><circle cx="${x}" cy="${y}" r="${radius}" fill="${propertyColor(unit.status)}" fill-opacity=".94" stroke="none"><title>${attr(unit.code)}</title></circle></g>`;
  }
  return renderPolygon(unit);
 }
 function renderPropertyLabel(unit){
  const numberLabel=unit.code.match(/^LOTE\s+(\d+)/i)?.[1]||unit.code;
  const fontSize=Math.max(12,Math.min(24,Math.max(state.scene.width,state.scene.height)*.018));
  if(unit.geometry?.type==='Point'&&Array.isArray(unit.geometry.coordinates)&&unit.geometry.coordinates.length===2){
   const [x,y]=unit.geometry.coordinates.map(Number),label=numberLabel;
   return floatingUnitLabel(unit,label,x,y,fontSize,true);
  }
  const points=unit.geometry?.coordinates?.[0];
  if(!Array.isArray(points)||points.length<3)return'';
  const labelPoint=points.reduce((sum,point)=>[sum[0]+point[0]/points.length,sum[1]+point[1]/points.length],[0,0]);
  return floatingUnitLabel(unit,numberLabel,labelPoint[0],labelPoint[1],fontSize,false);
 }
 function floatingUnitLabel(unit,label,x,y,fontSize,isPoint){
  const width=Math.max(fontSize*1.8,label.length*fontSize*.68+fontSize*.8),height=fontSize*1.55;
  return `<g class="plan-unit-label${isPoint?' point-label':''}" transform="translate(${x} ${y})" style="--unit-color:${propertyColor(unit.status)}"><rect x="${-width/2}" y="${-height/2}" width="${width}" height="${height}" rx="${height/2}"></rect><text x="0" y="0" style="font-size:${fontSize}px" text-anchor="middle" dominant-baseline="central">${attr(label)}</text></g>`;
 }
 function renderMapTools(){
  const tools=$('[data-role="map-tools"]');
  if(!planById()||!state.scene){tools.innerHTML='';return}
  if(!getIsAdmin()){tools.innerHTML='<span>Verde: disponible · Amarillo: reservado · Rojo: vendido · Gris: bloqueado</span>';return}
  const plan=planById(),project=projectById();
  const pdfLots=state.scene.background==='pdf'?state.scene.labels:[];
  const existingLotCodes=new Set(state.units.filter(unit=>unit.plan_id===plan.id&&unit.property_type==='Lote').map(unit=>unit.code));
  const importablePdfLots=pdfLots.filter(lot=>!existingLotCodes.has(lot.code));
  const isSicayaPlan=isHuertasSicayaPlan(project,plan);
  tools.innerHTML=`<span>Verde: disponible · Amarillo: reservado · Rojo: vendido · Gris: bloqueado</span>${plan.source_type==='dxf'&&state.scene.polygons.length&&!isSicayaPlan?`<button type="button" data-action="import-contours">Importar ${state.scene.polygons.length} contornos DXF detectados</button>`:''}${isSicayaPlan?`<span>${state.scene.huertasLotCount||0} de 14 lotes oficiales detectados por manzana, número y área.</span>`:''}${importablePdfLots.length?`<button type="button" data-action="import-pdf-lots">Importar ${importablePdfLots.length} lotes numerados detectados</button>`:pdfLots.length?`<span>${pdfLots.length} lotes numerados detectados.</span>`:''}`;
  tools.querySelector('[data-action="import-contours"]')?.addEventListener('click',()=>importDxfContours().catch(error=>statusMessage(`No se pudieron importar los contornos: ${error.message}`)));
  tools.querySelector('[data-action="import-pdf-lots"]')?.addEventListener('click',()=>importPdfLots().catch(error=>statusMessage(`No se pudieron importar los lotes del PDF: ${error.message}`)));
 }
 async function importDxfContours(){
  const plan=planById(),project=projectById();
  if(!getIsAdmin()||!plan||!project||!state.scene?.polygons?.length)return;
  if(!window.confirm(`Crear ${state.scene.polygons.length} registros editables sin inventar códigos, áreas oficiales ni precios?`))return;
  const existing=state.units.filter(unit=>unit.plan_id===plan.id).length;
  const records=state.scene.polygons.map(({points},index)=>({
   project_id:project.id,plan_id:plan.id,property_type:defaultType(project),code:`${defaultType(project)} ${existing+index+1}`,status:'available',
   geometry:{type:'Polygon',coordinates:[points]},created_by:getUser()?.id||null
  }));
  const {data,error}=await getSupabase().from('property_units').insert(records).select();
  if(error){statusMessage(`No se pudieron importar los contornos: ${error.message}`);return}
  state.units.push(...data);
  renderRangeFilters();
  renderPropertyList();renderSvg();renderMapTools();
  statusMessage(`Se importaron ${data.length} contornos. Completa los códigos, medidas oficiales y precios.`);
 }
 async function importHuertasSicayaLots(){
  const plan=planById(),project=projectById();
  if(!plan||!isHuertasSicayaPlan(project,plan))return;
  const matches=state.scene?.background==='pdf'?state.scene.sicayaLots||[]:state.scene?.background==='dxf'?matchHuertasSicayaLots(state.scene):[];
  if(matches.length!==HUERTAS_SICAYA_LOTS.length&&getIsAdmin()){
   throw new Error(`Se detectaron ${matches.length} de ${HUERTAS_SICAYA_LOTS.length} contornos coincidentes. Verifica que el plano de LAS HUERTAS DE SICAYA contenga las 14 parcelas.`);
  }
  const existingByCode=new Map(state.units.filter(unit=>unit.plan_id===plan.id&&unit.property_type==='Lote').map(unit=>[unit.code,unit]));
  const records=[],updates=[],previews=[];
  for(const {lot,polygon} of matches){
   const code=`LOTE ${lot.number} MZ ${lot.block}`,geometry={type:'Polygon',coordinates:[polygon.points]},existing=existingByCode.get(code);
   if(!existing){
    const record={project_id:project.id,plan_id:plan.id,property_type:'Lote',code,block:lot.block,area_land_m2:lot.area,status:lot.status,price:lot.price,geometry};
    if(getIsAdmin())records.push({...record,created_by:getUser()?.id||null});
    else previews.push({...record,id:`preview:${plan.id}:${code}`});
    continue;
   }
   const record={};
   if(JSON.stringify(existing.geometry)!==JSON.stringify(geometry))record.geometry=geometry;
   if(existing.block!==lot.block)record.block=lot.block;
   if(Number(existing.area_land_m2)!==lot.area)record.area_land_m2=lot.area;
   if(existing.status!==lot.status)record.status=lot.status;
   if(Number(existing.price)!==lot.price)record.price=lot.price;
   if(getIsAdmin()&&Object.keys(record).length)updates.push({unit:existing,record});
   else if(!getIsAdmin())Object.assign(existing,record,{geometry,block:lot.block,area_land_m2:lot.area,status:lot.status,price:lot.price});
  }
  const updated=getIsAdmin()?await Promise.all(updates.map(async({unit,record})=>{
   const {data,error}=await getSupabase().from('property_units').update(record).eq('id',unit.id).select().single();
   if(error)throw new Error(`No se pudo vincular el contorno de ${unit.code}: ${error.message}`);
   return data;
  })):[];
  let inserted=[];
  if(getIsAdmin()&&records.length){
   const {data,error}=await getSupabase().from('property_units').insert(records).select();
   if(error)throw new Error(error.message);
   inserted=data||[];
  }
  for(const unit of [...updated,...inserted,...previews]){
   state.units=state.units.filter(existing=>existing.id!==unit.id);
   state.units.push(unit);
  }
  renderRangeFilters();
  renderPropertyList();renderInspector();renderSvg();renderMapTools();
  if(records.length||updated.length)statusMessage(`Se sincronizaron ${records.length+updated.length} unidades de LAS HUERTAS DE SICAYA con sus contornos y manzanas.`);
 }
 async function importPdfLots(){
  const plan=planById(),project=projectById();
  if(!getIsAdmin()||!plan||!project||state.scene?.background!=='pdf')return;
  const existingCodes=new Set(state.units.filter(unit=>unit.plan_id===plan.id&&unit.property_type==='Lote').map(unit=>unit.code));
  const labels=state.scene.labels.filter(label=>!existingCodes.has(label.code));
  if(!labels.length){statusMessage('Los lotes numerados de este plano ya están importados.');return}
  const records=labels.map(label=>({
   project_id:project.id,plan_id:plan.id,property_type:'Lote',code:label.code,
   area_land_m2:label.area,status:'available',observations:label.observations||null,
   geometry:{type:'Point',coordinates:[label.x,label.y]},created_by:getUser()?.id||null
  }));
  const {data,error}=await getSupabase().from('property_units').insert(records).select();
  if(error)throw new Error(error.message);
  state.units.push(...data);
  renderRangeFilters();
  renderPropertyList();renderInspector();renderSvg();renderMapTools();
  statusMessage(`Se importaron ${data.length} lotes numerados desde el PDF. Las áreas con discrepancias quedan pendientes de validar; el estado y el precio no se inventaron.`);
 }

 function bindPan(){
  const pan=$('[data-role="pan"]');
  pan.addEventListener('pointerdown',event=>{
   if(event.target.closest('.plan-unit'))return;
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
    const viewport=sceneViewport(scene);
    const pan=$('[data-role="pan"]'),width=pan.clientWidth,height=pan.clientHeight;
    if(width&&height){
     const fit=Math.min(width/viewport.width,height/viewport.height);
     surface.style.width=`${viewport.width*fit}px`;
     surface.style.height=`${viewport.height*fit}px`;
    }
   }
  surface.style.transform=`translate(${state.panX}px,${state.panY}px) scale(${state.zoom})`;
 }

 initializeSelectors();
 window.addEventListener('resize',applyPanZoom);
 document.getElementById('plans-button').disabled=false;
 return{open,close};
}
