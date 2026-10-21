const CHANNELS=['WhatsApp','Instagram','Facebook','Correo','Urbania','TikTok','Llamada'];
const STAGES=['Nuevo','Contactado','Visita agendada','Negociación','Cerrado'];
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const localDate=()=>{
 const now=new Date();
 return new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);
};
const dateLabel=value=>value?new Date(`${value}T12:00:00`).toLocaleDateString('es-PE',{day:'numeric',month:'short',year:'numeric'}):'Sin fecha';

export function createCrmWorkspace({getSupabase,getIsAdmin,getUser,getProjects}){
 const root=document.createElement('section');
 root.id='crm-workspace';
 root.setAttribute('aria-label','CRM inmobiliario');
 root.innerHTML=`<style>
 #crm-workspace{position:fixed;inset:0;z-index:30;display:none;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","SF Pro Display","Segoe UI",sans-serif}
 #crm-workspace.open{display:flex;flex-direction:column}
 .crm-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 18px;border-bottom:1px solid var(--line);background:var(--panel)}
 .crm-header div{display:grid;gap:2px}.crm-header strong{font-size:17px}.crm-header span{font-size:12px;color:var(--mute)}
 .crm-header button,.crm-button{padding:8px 12px;border:0;border-radius:999px;background:var(--sel);color:var(--bg);font:inherit;font-size:12px;font-weight:600;cursor:pointer}
 .crm-body{display:grid;grid-template-columns:190px minmax(0,1fr);flex:1;min-height:0}
 .crm-nav{display:flex;flex-direction:column;gap:5px;padding:14px 10px;border-right:1px solid var(--line);background:var(--panel)}
 .crm-brand{padding:5px 8px 12px;font-size:14px;font-weight:700}
 .crm-nav button{display:flex;justify-content:space-between;gap:8px;width:100%;padding:9px 10px;border:0;border-radius:9px;background:transparent;color:var(--ink);text-align:left;font:inherit;font-size:12px;cursor:pointer}
 .crm-nav button.active,.crm-nav button:hover{background:color-mix(in srgb,var(--sel) 10%,var(--panel))}
 .crm-nav button.active{color:var(--sel);font-weight:700}
 .crm-count{min-width:20px;padding:1px 6px;border-radius:99px;background:color-mix(in srgb,var(--sel) 12%,var(--panel));text-align:center}
 .crm-main{display:flex;flex-direction:column;min-width:0;min-height:0}
 .crm-status{min-height:0;padding:0 14px;color:var(--mute);font-size:11px}
 .crm-status:not(:empty){padding-top:7px;padding-bottom:7px;border-bottom:1px solid var(--line)}
 .crm-inbox{display:grid;grid-template-columns:minmax(230px,300px) minmax(260px,1fr) minmax(220px,270px);flex:1;min-height:0}
 .crm-pane{min-width:0;min-height:0;overflow:auto;border-right:1px solid var(--line);background:var(--panel)}
 .crm-pane:last-child{border:0}
 .crm-filters{position:sticky;top:0;z-index:1;display:grid;gap:7px;padding:10px;border-bottom:1px solid var(--line);background:var(--panel)}
 .crm-filters select,.crm-page select,.crm-form input,.crm-form select,.crm-form textarea,.crm-note-form textarea,.crm-task-form input,.crm-task-form textarea{width:100%;min-height:36px;padding:7px 9px;border:1px solid var(--line);border-radius:9px;background:var(--bg);color:var(--ink);font:inherit;font-size:12px}
 .crm-lead-row{display:flex;gap:9px;width:100%;padding:10px;border:0;border-bottom:1px solid var(--line);background:transparent;color:var(--ink);text-align:left;cursor:pointer}
 .crm-lead-row:hover,.crm-lead-row.selected{background:var(--bg)}
 .crm-avatar{display:grid;place-items:center;flex:none;width:34px;height:34px;border-radius:50%;background:color-mix(in srgb,var(--sel) 12%,var(--panel));font-size:11px;font-weight:700}
 .crm-row-content{min-width:0;flex:1}.crm-row-top{display:flex;justify-content:space-between;gap:5px}.crm-row-top b{overflow:hidden;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.crm-row-top small,.crm-row-sub{color:var(--mute);font-size:10px}
 .crm-row-sub{overflow:hidden;margin-top:3px;text-overflow:ellipsis;white-space:nowrap}
 .crm-tags{display:flex;gap:5px;flex-wrap:wrap;margin-top:5px}
 .crm-tag{padding:2px 6px;border-radius:6px;background:color-mix(in srgb,var(--sel) 9%,var(--panel));color:var(--mute);font-size:10px}
 .crm-thread{display:flex;flex-direction:column;height:100%;background:var(--bg)}
 .crm-thread-head{padding:12px 14px;border-bottom:1px solid var(--line);background:var(--panel)}
 .crm-thread-head strong{font-size:14px}.crm-thread-head small{color:var(--mute);font-size:11px}
 .crm-messages{display:flex;flex:1;flex-direction:column;gap:8px;overflow:auto;padding:14px}
 .crm-message{max-width:80%;padding:8px 11px;border:1px solid var(--line);border-radius:12px;background:var(--panel);font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere}
 .crm-message.team{align-self:flex-end;border-color:transparent;background:color-mix(in srgb,var(--sel) 12%,var(--panel))}
 .crm-message small{display:block;margin-top:4px;color:var(--mute);font-size:10px}
 .crm-note-form{display:grid;grid-template-columns:110px minmax(0,1fr) auto;gap:6px;padding:9px;border-top:1px solid var(--line);background:var(--panel)}
 .crm-note-form button,.crm-task-form button,.crm-form button,.crm-page button{padding:8px 11px;border:0;border-radius:9px;background:var(--sel);color:var(--bg);font:inherit;font-size:11px;font-weight:600;cursor:pointer}
 .crm-detail{display:flex;flex-direction:column;gap:12px;padding:13px}
 .crm-detail label,.crm-form label{display:grid;gap:4px;color:var(--mute);font-size:11px}
 .crm-detail select{width:100%;min-height:34px;padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);font:inherit;font-size:12px}
 .crm-detail h3{margin:4px 0;font-size:12px}.crm-detail p{margin:0;font-size:12px;overflow-wrap:anywhere}
 .crm-detail small{color:var(--mute);font-size:10px}
 .crm-task-form{display:grid;gap:6px;margin-top:7px}
 .crm-task{display:grid;grid-template-columns:auto 1fr;gap:7px;padding:7px 0;border-bottom:1px solid var(--line);font-size:11px}
 .crm-task.done span{text-decoration:line-through;color:var(--mute)}
 .crm-task small{display:block}.crm-overdue{color:#c43d32!important}
 .crm-page{min-height:0;overflow:auto;padding:18px}
 .crm-page h2{margin:0;font-size:18px}.crm-page>p{color:var(--mute);font-size:12px}
 .crm-pipeline{display:flex;gap:7px;overflow:auto;margin:12px 0}
 .crm-pipeline div{min-width:100px;padding:8px 11px;border:1px solid var(--line);border-radius:10px;background:var(--panel)}
 .crm-pipeline b{display:block;font-size:17px}.crm-pipeline span{color:var(--mute);font-size:10px}
 .crm-toolbar{display:flex;gap:7px;flex-wrap:wrap;margin:12px 0}
 .crm-toolbar input,.crm-toolbar select{min-height:36px;padding:7px 9px;border:1px solid var(--line);border-radius:9px;background:var(--panel);color:var(--ink);font:inherit;font-size:12px}
 .crm-table-wrap{overflow:auto;border:1px solid var(--line);border-radius:10px;background:var(--panel)}
 .crm-table{width:100%;min-width:760px;border-collapse:collapse;font-size:11px}
 .crm-table th,.crm-table td{padding:9px 10px;border-bottom:1px solid var(--line);text-align:left}
 .crm-table th{color:var(--mute);font-weight:600}
 .crm-table tr:last-child td{border-bottom:0}
 .crm-table td button{padding:0;background:none;color:var(--sel);text-align:left}
 .crm-empty{padding:22px;color:var(--mute);text-align:center;font-size:12px}
 .crm-modal{position:fixed;inset:0;z-index:2;display:grid;place-items:center;padding:16px;background:#0007}
 .crm-form{display:grid;gap:10px;width:min(470px,100%);max-height:90vh;overflow:auto;padding:18px;border:1px solid var(--line);border-radius:14px;background:var(--panel);box-shadow:0 16px 50px #0003}
 .crm-form h2{margin:0;font-size:16px}.crm-form-actions{display:flex;justify-content:flex-end;gap:7px}
 .crm-form button.secondary{border:1px solid var(--line);background:transparent;color:var(--ink)}
 .crm-warning{padding:10px;border:1px solid var(--line);border-radius:9px;color:var(--mute);font-size:11px;line-height:1.45}
 @media(max-width:1000px){.crm-body{grid-template-columns:150px minmax(0,1fr)}.crm-inbox{grid-template-columns:minmax(190px,240px) minmax(250px,1fr)}.crm-inbox>.crm-pane:last-child{grid-column:1/-1;max-height:35vh;border-top:1px solid var(--line)}}
 @media(max-width:650px){.crm-body{grid-template-columns:1fr;grid-template-rows:auto minmax(0,1fr)}.crm-nav{flex-direction:row;overflow:auto;padding:6px;border:0;border-bottom:1px solid var(--line)}.crm-brand{display:none}.crm-nav button{width:auto;flex:none;white-space:nowrap}.crm-inbox{grid-template-columns:1fr;grid-template-rows:minmax(120px,27vh) minmax(260px,1fr) auto;overflow:auto}.crm-inbox>.crm-pane:last-child{grid-column:auto;max-height:none}.crm-pane{border-right:0;border-bottom:1px solid var(--line)}.crm-thread{min-height:360px}.crm-note-form{grid-template-columns:95px minmax(0,1fr)}.crm-note-form button{grid-column:1/-1}.crm-page{padding:12px}.crm-header{padding:10px 12px}}
 </style>
 <header class="crm-header"><div><strong>CRM inmobiliario</strong><span>Gestión privada de clientes, conversaciones y seguimiento</span></div><button type="button" data-crm-action="close">Volver al mapa</button></header>
 <div class="crm-body"><nav class="crm-nav" aria-label="Secciones del CRM"><div class="crm-brand">HABITAT · CRM</div><button type="button" data-crm-view="inbox">Bandeja</button><button type="button" data-crm-view="leads">Leads</button><button type="button" data-crm-view="tasks">Seguimiento <span class="crm-count" data-crm-count="tasks">0</span></button></nav><main class="crm-main"><p class="crm-status" role="status" aria-live="polite"></p><div class="crm-content"></div></main></div>`;
 document.body.append(root);
 const $=selector=>root.querySelector(selector);
 const state={open:false,refreshTimer:null,view:'inbox',leads:[],messages:[],tasks:[],selectedId:null,channel:'Todos',stage:'Todos',owner:'all',search:'',modal:null};
 const projects=getProjects().map(project=>project.n).filter(Boolean);
 const currentUser=()=>getUser();
 const selectedLead=()=>state.leads.find(lead=>lead.id===state.selectedId)||null;
 const statusMessage=text=>{$('.crm-status').textContent=text||''};
 const showError=(action,error)=>statusMessage(`${action}: ${error.message||error}`);
 const leadMessages=leadId=>state.messages.filter(message=>message.lead_id===leadId);
 const leadTasks=leadId=>state.tasks.filter(task=>task.lead_id===leadId).sort((a,b)=>a.due_date.localeCompare(b.due_date));
 const options=(items,value,placeholder='')=>`${placeholder?`<option value="">${escapeHtml(placeholder)}</option>`:''}${items.map(item=>`<option value="${escapeHtml(item)}"${item===value?' selected':''}>${escapeHtml(item)}</option>`).join('')}`;

 function filteredLeads(){
  const userId=currentUser()?.id;
  const query=state.search.trim().toLocaleLowerCase('es');
  return state.leads.filter(lead=>{
   if(state.channel!=='Todos'&&lead.channel!==state.channel)return false;
   if(state.stage!=='Todos'&&lead.stage!==state.stage)return false;
   if(state.owner==='mine'&&lead.assigned_to!==userId)return false;
   return !query||[lead.name,lead.contact,lead.project_interest,lead.campaign].some(value=>String(value||'').toLocaleLowerCase('es').includes(query));
  });
 }
 function lastMessage(leadId){
  return leadMessages(leadId).slice().sort((a,b)=>b.created_at.localeCompare(a.created_at))[0]||null;
 }
 function render(){
  if(!state.open)return;
  root.querySelectorAll('[data-crm-view]').forEach(button=>button.classList.toggle('active',button.dataset.crmView===state.view));
  $('[data-crm-count="tasks"]').textContent=String(state.tasks.filter(task=>!task.completed&&task.due_date<=localDate()).length);
  const content=$('.crm-content');
  content.innerHTML=state.view==='inbox'?renderInbox():state.view==='leads'?renderLeads():renderTasks();
  renderModal();
 }
 function renderInbox(){
  const leads=filteredLeads();
  if(!leads.some(lead=>lead.id===state.selectedId))state.selectedId=leads[0]?.id||null;
  const current=selectedLead();
  const left=`<section class="crm-pane"><div class="crm-filters"><input type="search" data-crm-search placeholder="Buscar lead" value="${escapeHtml(state.search)}" aria-label="Buscar lead"><select data-crm-filter="channel" aria-label="Filtrar canal">${options(['Todos',...CHANNELS],state.channel)}</select><select data-crm-filter="stage" aria-label="Filtrar etapa">${options(['Todos',...STAGES],state.stage)}</select><select data-crm-filter="owner" aria-label="Filtrar responsable"><option value="all"${state.owner==='all'?' selected':''}>Todos los leads</option><option value="mine"${state.owner==='mine'?' selected':''}>Mis leads</option></select><button class="crm-button" type="button" data-crm-action="new-lead">Registrar lead</button></div>${leads.length?leads.map(lead=>{
   const message=lastMessage(lead.id);
   return `<button type="button" class="crm-lead-row${lead.id===state.selectedId?' selected':''}" data-crm-select="${escapeHtml(lead.id)}"><span class="crm-avatar">${escapeHtml(lead.name.split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase())}</span><span class="crm-row-content"><span class="crm-row-top"><b>${escapeHtml(lead.name)}</b><small>${message?escapeHtml(new Date(message.created_at).toLocaleDateString('es-PE')):''}</small></span><span class="crm-row-sub">${message?escapeHtml(message.body):'Sin mensajes registrados'}</span><span class="crm-tags"><span class="crm-tag">${escapeHtml(lead.channel)}</span><span class="crm-tag">${escapeHtml(lead.stage)}</span></span></span></button>`;
  }).join(''):'<div class="crm-empty">Aún no hay leads. Registra un cliente real para comenzar.</div>'}</section>`;
  if(!current)return `<div class="crm-inbox">${left}<section class="crm-pane"><div class="crm-empty">Selecciona un lead o registra uno nuevo.</div></section><section class="crm-pane"></section></div>`;
  const messages=leadMessages(current.id).slice().sort((a,b)=>a.created_at.localeCompare(b.created_at));
  const thread=`<section class="crm-pane"><div class="crm-thread"><div class="crm-thread-head"><strong>${escapeHtml(current.name)}</strong><br><small>${escapeHtml(current.channel)} · ${escapeHtml(current.contact||'Sin dato de contacto')}</small></div><div class="crm-messages">${messages.length?messages.map(message=>`<div class="crm-message ${message.sender==='team'?'team':''}">${escapeHtml(message.body)}<small>${message.sender==='team'?'Equipo':'Cliente'} · ${escapeHtml(new Date(message.created_at).toLocaleString('es-PE'))}</small></div>`).join(''):'<div class="crm-empty">No hay mensajes registrados para este lead.</div>'}</div><form class="crm-note-form" data-crm-form="message"><select name="sender" aria-label="Autor del registro"><option value="team">Equipo</option><option value="lead">Cliente</option></select><textarea name="body" rows="2" maxlength="4000" placeholder="Registra un mensaje o nota del historial…" required></textarea><button type="submit">Guardar en historial</button></form></div></section>`;
  const tasks=leadTasks(current.id);
  const owner=current.assigned_to===currentUser()?.id?'Tú':current.assigned_to?'Otro administrador':'Sin asignar';
  const detail=`<section class="crm-pane"><div class="crm-detail"><label>Etapa<select data-crm-stage="${escapeHtml(current.id)}">${options(STAGES,current.stage)}</select></label><div><h3>Interés</h3><p>${escapeHtml(current.project_interest||'Por definir')}</p><small>Presupuesto: ${escapeHtml(current.budget||'Por definir')}<br>Campaña: ${escapeHtml(current.campaign||'—')}<br>Responsable: ${owner}</small><br><button type="button" class="crm-button" data-crm-action="edit-lead" data-crm-id="${escapeHtml(current.id)}" style="margin-top:7px">Editar lead</button></div><div><h3>Seguimiento</h3>${tasks.length?tasks.map(task=>`<label class="crm-task${task.completed?' done':''}"><input type="checkbox" data-crm-task="${escapeHtml(task.id)}"${task.completed?' checked':''}><span>${escapeHtml(task.description)}<small class="${!task.completed&&task.due_date<localDate()?'crm-overdue':''}">${!task.completed&&task.due_date<localDate()?'Vencida · ':''}${escapeHtml(dateLabel(task.due_date))}</small></span></label>`).join(''):'<small>Sin tareas registradas.</small>'}<form class="crm-task-form" data-crm-form="task"><input name="description" maxlength="300" placeholder="Nueva tarea de seguimiento" required><input name="due_date" type="date" value="${localDate()}" required><button type="submit">Agregar tarea</button></form></div></div></section>`;
  return `<div class="crm-inbox">${left}${thread}${detail}</div>`;
 }
 function renderLeads(){
  const leads=filteredLeads();
  const pipeline=STAGES.map(stage=>`<div><b>${state.leads.filter(lead=>lead.stage===stage).length}</b><span>${escapeHtml(stage)}</span></div>`).join('');
  return `<section class="crm-page"><h2>Leads</h2><div class="crm-pipeline">${pipeline}</div><div class="crm-toolbar"><input type="search" data-crm-search placeholder="Buscar por nombre, contacto o proyecto" value="${escapeHtml(state.search)}"><select data-crm-filter="channel">${options(['Todos',...CHANNELS],state.channel)}</select><select data-crm-filter="stage">${options(['Todos',...STAGES],state.stage)}</select><select data-crm-filter="owner"><option value="all"${state.owner==='all'?' selected':''}>Todos los leads</option><option value="mine"${state.owner==='mine'?' selected':''}>Mis leads</option></select><button type="button" data-crm-action="new-lead">Registrar lead</button></div><div class="crm-table-wrap"><table class="crm-table"><thead><tr><th>Nombre</th><th>Contacto</th><th>Canal</th><th>Proyecto de interés</th><th>Etapa</th><th></th></tr></thead><tbody>${leads.length?leads.map(lead=>`<tr><td><button type="button" data-crm-select="${escapeHtml(lead.id)}">${escapeHtml(lead.name)}</button></td><td>${escapeHtml(lead.contact||'—')}</td><td>${escapeHtml(lead.channel)}</td><td>${escapeHtml(lead.project_interest||'—')}</td><td>${escapeHtml(lead.stage)}</td><td><button type="button" data-crm-action="edit-lead" data-crm-id="${escapeHtml(lead.id)}">Editar</button></td></tr>`).join(''):'<tr><td colspan="6" class="crm-empty">No hay leads registrados con estos filtros.</td></tr>'}</tbody></table></div></section>`;
 }
 function renderTasks(){
  const tasks=state.tasks.slice().sort((a,b)=>Number(a.completed)-Number(b.completed)||a.due_date.localeCompare(b.due_date));
  return `<section class="crm-page"><h2>Seguimiento</h2><p>Tareas de todos los leads, ordenadas por vencimiento.</p><div class="crm-table-wrap"><table class="crm-table"><thead><tr><th>Estado</th><th>Tarea</th><th>Lead</th><th>Vencimiento</th></tr></thead><tbody>${tasks.length?tasks.map(task=>`<tr><td><input type="checkbox" data-crm-task="${escapeHtml(task.id)}"${task.completed?' checked':''} aria-label="Completar tarea"></td><td>${escapeHtml(task.description)}</td><td><button type="button" data-crm-select="${escapeHtml(task.lead_id)}">${escapeHtml(state.leads.find(lead=>lead.id===task.lead_id)?.name||'Lead eliminado')}</button></td><td>${escapeHtml(dateLabel(task.due_date))}</td></tr>`).join(''):'<tr><td colspan="4" class="crm-empty">No hay tareas de seguimiento.</td></tr>'}</tbody></table></div></section>`;
 }
 function renderModal(){
  const modal=state.modal;
  if(!modal){root.querySelector('.crm-modal')?.remove();return}
  const lead=modal.id?state.leads.find(item=>item.id===modal.id):null;
  const values=modal.values||(lead?{name:lead.name,contact:lead.contact||'',channel:lead.channel,campaign:lead.campaign||'',project_interest:lead.project_interest||'',budget:lead.budget||''}:{name:'',contact:'',channel:'WhatsApp',campaign:'',project_interest:'',budget:''});
  const projectOptions=['Por definir',...projects.filter(name=>name!==values.project_interest),...(values.project_interest&&!projects.includes(values.project_interest)?[values.project_interest]:[])];
  const overlay=document.createElement('div');
  overlay.className='crm-modal';
  overlay.setAttribute('role','presentation');
  overlay.innerHTML=`<form class="crm-form" data-crm-form="lead" role="dialog" aria-modal="true" aria-labelledby="crm-form-title"><h2 id="crm-form-title">${lead?'Editar lead':'Registrar lead'}</h2><label>Nombre<input name="name" maxlength="160" value="${escapeHtml(values.name)}" autocomplete="name" required></label><label>Teléfono o correo<input name="contact" maxlength="180" value="${escapeHtml(values.contact)}" autocomplete="email"></label><label>Canal<select name="channel">${options(CHANNELS,values.channel)}</select></label><label>Campaña<input name="campaign" maxlength="180" value="${escapeHtml(values.campaign)}"></label><label>Proyecto de interés<select name="project_interest">${options(projectOptions,values.project_interest,'Selecciona un proyecto')}</select></label><label>Presupuesto<input name="budget" maxlength="100" value="${escapeHtml(values.budget)}" placeholder="Por definir"></label><p class="crm-warning">El CRM registra datos y mensajes internamente. No envía mensajes a WhatsApp, Instagram, correo ni otros canales.</p><div class="crm-form-actions"><button class="secondary" type="button" data-crm-action="cancel-modal">Cancelar</button><button type="submit">Guardar lead</button></div></form>`;
  const previous=root.querySelector('.crm-modal');
  if(previous)previous.replaceWith(overlay);
  else root.querySelector('.crm-content').append(overlay);
 }
 async function load(){
  if(!getIsAdmin())throw new Error('Inicia sesión con una cuenta administradora para usar el CRM.');
  const supabase=getSupabase();
  if(!supabase)throw new Error('Supabase no está conectado; no se puede cargar el CRM.');
  const [leadResult,messageResult,taskResult]=await Promise.all([
   supabase.from('crm_leads').select('*').order('updated_at',{ascending:false}),
   supabase.from('crm_messages').select('*').order('created_at'),
   supabase.from('crm_tasks').select('*').order('due_date')
  ]);
  if(leadResult.error)throw new Error(`No se pudieron cargar los leads. Aplica supabase-crm-migration.sql: ${leadResult.error.message}`);
  if(messageResult.error)throw new Error(`No se pudo cargar el historial de mensajes: ${messageResult.error.message}`);
  if(taskResult.error)throw new Error(`No se pudieron cargar las tareas: ${taskResult.error.message}`);
  state.leads=leadResult.data||[];
  state.messages=messageResult.data||[];
  state.tasks=taskResult.data||[];
  if(!state.leads.some(lead=>lead.id===state.selectedId))state.selectedId=state.leads[0]?.id||null;
  render();
 }
 async function perform(action,callback){
  statusMessage('');
  try{await callback()}
  catch(error){showError(action,error)}
 }
 function close(){
  state.open=false;
  root.classList.remove('open');
  document.body.classList.remove('crm-open');
  window.clearInterval(state.refreshTimer);
  state.refreshTimer=null;
  state.leads=[];state.messages=[];state.tasks=[];state.selectedId=null;state.modal=null;
  $('.crm-content').replaceChildren();
  statusMessage('');
 }
 async function open(){
  if(!getIsAdmin())throw new Error('El CRM está disponible únicamente para administradores autorizados.');
  if(!getSupabase())throw new Error('Supabase no está conectado.');
  state.open=true;
  root.classList.add('open');
  document.body.classList.add('crm-open');
  try{
   await load();
   state.refreshTimer=window.setInterval(()=>{
    if(!state.open)return;
    if(!getIsAdmin()){close();return}
    if(!state.modal)perform('No se pudieron actualizar los datos del CRM',load);
   },30000);
  }catch(error){close();throw error}
 }
 async function saveLead(form){
  const values=Object.fromEntries(new FormData(form).entries());
  const leadId=state.modal?.id;
  const user=currentUser();
  const record={
   name:String(values.name).trim(),
   contact:String(values.contact||'').trim()||null,
   channel:String(values.channel),
   campaign:String(values.campaign||'').trim()||null,
   project_interest:String(values.project_interest||'').trim()||null,
   budget:String(values.budget||'').trim()||null
  };
  if(!record.name)throw new Error('El nombre del lead es obligatorio.');
  if(leadId){
   const {data,error}=await getSupabase().from('crm_leads').update({...record,updated_at:new Date().toISOString()}).eq('id',leadId).select().single();
   if(error)throw new Error(`No se pudo actualizar el lead: ${error.message}`);
   state.leads=state.leads.map(lead=>lead.id===leadId?data:lead);
  }else{
   const {data,error}=await getSupabase().from('crm_leads').insert({...record,stage:'Nuevo',assigned_to:user.id,created_by:user.id}).select().single();
   if(error)throw new Error(`No se pudo registrar el lead: ${error.message}`);
   state.leads.unshift(data);
   state.selectedId=data.id;
   state.view='inbox';
  }
  state.modal=null;
  statusMessage(leadId?'Cambios guardados.':'Lead registrado.');
  render();
 }
 async function setStage(leadId,stage){
  if(!STAGES.includes(stage))throw new Error('La etapa seleccionada no es válida.');
  const {data,error}=await getSupabase().from('crm_leads').update({stage,updated_at:new Date().toISOString()}).eq('id',leadId).select().single();
  if(error)throw new Error(`No se pudo actualizar la etapa: ${error.message}`);
  state.leads=state.leads.map(lead=>lead.id===leadId?data:lead);
  render();
 }
 async function saveMessage(form){
  const lead=selectedLead();
  if(!lead)throw new Error('Selecciona un lead antes de registrar un mensaje.');
  const values=Object.fromEntries(new FormData(form).entries());
  const body=String(values.body||'').trim();
  if(!body)throw new Error('Escribe el mensaje antes de guardarlo.');
  const {data,error}=await getSupabase().from('crm_messages').insert({lead_id:lead.id,sender:values.sender,body,created_by:currentUser().id}).select().single();
  if(error)throw new Error(`No se pudo guardar el historial: ${error.message}`);
  state.messages.push(data);
  statusMessage('Registro agregado al historial; no se envió a ningún canal externo.');
  render();
 }
 async function saveTask(form){
  const lead=selectedLead();
  if(!lead)throw new Error('Selecciona un lead antes de crear una tarea.');
  const values=Object.fromEntries(new FormData(form).entries());
  const description=String(values.description||'').trim();
  if(!description)throw new Error('La descripción de la tarea es obligatoria.');
  if(!values.due_date)throw new Error('Indica la fecha de vencimiento.');
  const {data,error}=await getSupabase().from('crm_tasks').insert({lead_id:lead.id,description,due_date:values.due_date,created_by:currentUser().id}).select().single();
  if(error)throw new Error(`No se pudo guardar la tarea: ${error.message}`);
  state.tasks.push(data);
  render();
 }
 async function toggleTask(taskId,completed){
  const {data,error}=await getSupabase().from('crm_tasks').update({completed}).eq('id',taskId).select().single();
  if(error)throw new Error(`No se pudo actualizar la tarea: ${error.message}`);
  state.tasks=state.tasks.map(task=>task.id===taskId?data:task);
  render();
 }
 root.addEventListener('click',event=>{
  const closeButton=event.target.closest('[data-crm-action="close"]');
  if(closeButton){close();return}
  const viewButton=event.target.closest('[data-crm-view]');
  if(viewButton){state.view=viewButton.dataset.crmView;render();return}
  const selectButton=event.target.closest('[data-crm-select]');
  if(selectButton){state.selectedId=selectButton.dataset.crmSelect;state.view='inbox';render();return}
  const actionButton=event.target.closest('[data-crm-action]');
  if(!actionButton)return;
  if(actionButton.dataset.crmAction==='new-lead'){state.modal={};renderModal()}
  else if(actionButton.dataset.crmAction==='edit-lead'){state.modal={id:actionButton.dataset.crmId};renderModal()}
  else if(actionButton.dataset.crmAction==='cancel-modal'){state.modal=null;renderModal()}
 });
 root.addEventListener('input',event=>{
  if(event.target.matches('[data-crm-search]')){
   state.search=event.target.value;
   const cursor=event.target.selectionStart;
   render();
   const replacement=root.querySelector('[data-crm-search]');
   replacement?.focus();replacement?.setSelectionRange(cursor,cursor);
  }
 });
 root.addEventListener('change',event=>{
  if(event.target.matches('[data-crm-filter="channel"]')){state.channel=event.target.value;render()}
  else if(event.target.matches('[data-crm-filter="stage"]')){state.stage=event.target.value;render()}
  else if(event.target.matches('[data-crm-filter="owner"]')){state.owner=event.target.value;render()}
  else if(event.target.matches('[data-crm-stage]'))perform('No se pudo cambiar la etapa',()=>setStage(event.target.dataset.crmStage,event.target.value));
  else if(event.target.matches('[data-crm-task]'))perform('No se pudo actualizar la tarea',()=>toggleTask(event.target.dataset.crmTask,event.target.checked));
 });
 root.addEventListener('submit',event=>{
  const form=event.target.closest('[data-crm-form]');
  if(!form)return;
  event.preventDefault();
  if(form.dataset.crmForm==='lead')perform('No se pudo guardar el lead',()=>saveLead(form));
  else if(form.dataset.crmForm==='message')perform('No se pudo registrar el mensaje',()=>saveMessage(form));
  else if(form.dataset.crmForm==='task')perform('No se pudo agregar la tarea',()=>saveTask(form));
 });
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&state.open){state.modal=null;render();close()}});
 return{open,close};
}
