import { requestJson } from './request.mjs?v=20261004-lab2';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.2';
import { labUrl, publishableKey } from './lab-config.mjs?v=20261004-lab2';
import { MotionPresenter, spriteSource } from './motion.mjs?v=20261004-onod1';
import { renderArena } from './presentation.mjs?v=20261004-korgan1';
import { catalog } from './catalog.mjs';
import { LiveSession, newId } from './session.mjs?v=20261004-lab2';
import { championDefinitions, calculatePath, previewPath, abilityTargets, pillarAvailable, colosoActionTargets, magnetismTargets, impulseDestinations, piplusMarkTargets, germinateDestinations, onodActionTargets, vinesDestinations, korganTrapDestinations, korganGrenadeDestinations, hunterStepDestinations, korganDisarmTargets } from '../combat-core.mjs?v=20261004-korgan1';

const client=createClient(labUrl,publishableKey,{auth:{storageKey:'live-v2-lab2-auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
const app=document.querySelector('#app'),notice=document.querySelector('#notice');
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const errors={CONNECTION_TIMEOUT:'La conexión tardó demasiado. Reintentá; no confirmamos ninguna acción localmente.',UNAUTHENTICATED:'No se pudo validar la sesión. Reintentá.',FORBIDDEN:'Esta acción no corresponde a tu controlador.',SLOT_TAKEN:'La sala ya tiene otro participante.',JOIN_CLOSED:'El combate ya empezó.',MATCH_NOT_FOUND:'No encontramos esa sala.',VERSION_CONFLICT:'La partida cambió. Actualizamos el estado.',TURN_EXPIRED:'El turno terminó.',INSUFFICIENT_PA:'No tenés suficientes PA.',ABILITY_LIMIT:'Alcanzaste el límite de usos este turno.',BLOCKED_LOS:'La línea de visión está bloqueada.',OUT_OF_RANGE:'El objetivo está fuera del alcance.',ABILITY_NOT_SELECTED:'La habilidad no está en tus cuatro elegidas.',ONOD_ACTION_UNAVAILABLE:'Germinar o Marchitar no está disponible en esa casilla o este turno.',KORGAN_ACTION_UNAVAILABLE:'Desarmar Trampa no está disponible.',INVALID_DISTANCE:'Elegí atraer 1 o 2 casillas.',MARK_UNAVAILABLE:'La Marca ya se usó, está bloqueada o el objetivo no es válido.',INVALID_TARGET:'Ese objetivo no es válido para la acción elegida.',INVALID_PATH:'Ese recorrido no es válido.',LETHAL_TACKLE:'Ese recorrido sería mortal por placaje.',INVALID_POSITION:'Elegí una casilla marcada de tu zona.',CONNECTION_PENDING:'Sin respuesta. La acción quedó pendiente; la recuperaremos al reconectar.',COMMAND_PENDING:'Esperá la confirmación de la acción anterior.'};
let notifyTimer;function notify(message){notice.textContent=errors[message]??message;notice.style.display='block';clearTimeout(notifyTimer);notifyTimer=setTimeout(()=>notice.style.display='none',6000);}
let deadlineExpired=false,hudCollapsed=false,abilitySelection=null;
let actor=null,joining=false,draft=null,slotId=null,lastRendered='',reloading=false;
async function ensureAuth(){
  let {data:{session},error}=await client.auth.getSession();if(error)throw error;
  if(!session){const created=await client.auth.signInAnonymously();if(created.error)throw created.error;session=created.data.session;}
  if(!session)throw new Error('UNAUTHENTICATED');actor=session.user.id;return session;
}
async function api(operation,args){
  const auth=await ensureAuth();
  return requestJson(`${labUrl}/functions/v1/live-v2-command`,{method:'POST',headers:{authorization:`Bearer ${auth.access_token}`,apikey:publishableKey,'content-type':'application/json'},body:JSON.stringify({operation,args})});
}
const motion=new MotionPresenter();
for(const id of Object.keys(catalog))for(const direction of ['down-right','down-left','up-right','up-left']){const image=new Image();image.src=spriteSource(id,direction);}
const game=new LiveSession({api,storage:localStorage,onChange:()=>render(),onError:notify});
const ownSlots=()=>Object.values(game.state?.slots??{}).filter(s=>s.controllerId===actor);
const ownSlot=()=>game.state?.slots[slotId]??ownSlots()[0];
const activeUnit=()=>game.state?.combat?.units.find(u=>u.id===game.state.combat.order[game.state.combat.turnIndex]);
const canMove=()=>game.canAct()&&activeUnit()?.controllerId===actor;
function remaining(){const expired=game.remaining()===0;if(expired!==deadlineExpired){deadlineExpired=expired;game.preview=null;render(true);return;}document.querySelector('#timer')?.replaceChildren(String(game.remaining()??'—'));if(game.remaining()===0&&game.preview){game.preview=null;render(true);}}
function link(){const url=new URL(location.href);url.search='';url.searchParams.set('v','20261004-korgan1');url.searchParams.set('match',game.state.id);return url.href;}
function roomId(value){
  let id=value.trim();try{const url=new URL(id);id=url.searchParams.get('match')??'';}catch{}
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw new Error('Pegá el enlace o el identificador completo de la sala.');return id.toLowerCase();
}
async function enter(id,create=false){
  if(joining)return;joining=true;render(true);
  try{
    await ensureAuth();let state;
    if(create)state=(await api('create',{room:{id}})).data;
    else{
      try{state=(await api('snapshot',{matchId:id})).data;}
      catch(error){if(error.message!=='FORBIDDEN')throw error;state=(await api('join',{matchId:id,slotId:'B1'})).data;}
    }
    const url=new URL(location.href);url.searchParams.set('match',id);history.replaceState(null,'',url);
    await game.attach(actor,state);notify(create?'Sala creada. Compartí el enlace con el otro celular.':'Conectado a la sala.');
  }catch(error){notify(error.message);}finally{joining=false;render(true);}
}
function teams(){return `<div class="teams">${Object.values(game.state.slots).map(s=>{
  const u=game.state.combat?.units.find(u=>u.id===s.id),mine=s.controllerId===actor;
  return `<article class="unit-card ${mine?'':'enemy'} ${activeUnit()?.id===s.id?'active':''}"><div class="row">${s.championId?`<img src="../assets/champions/${s.championId}/${s.championId}-avatar.png" alt="">`:''}<strong>${escape(catalog[s.championId]?.name??'Sin selección')}</strong><span class="tag">${escape(s.id)} · ${mine?'Tu control':'Rival'}</span></div><p>${u?`${u.hp} PV · ${u.pa} PA · ${u.pm} PM`:game.state.phase==='preparation'&&!s.controllerId?'Esperando otro celular':game.state.phase==='preparation'?(s.ready?'Listo':'Preparando'):(s.confirmed?'Posición confirmada':'Desplegando')}</p></article>`;
}).join('')}</div>`;}
function roomBar(){return `<div class="room-bar row spread"><span class="tag">${escape(game.state.id.slice(0,8))} · Sala 1v1</span><button data-action="copy" class="subtle">Copiar enlace</button><button data-action="leave" class="subtle">Salir de la vista</button></div>`;}
function setupDraft(){
  const own=ownSlots();if(!own.some(s=>s.id===slotId))slotId=own[0]?.id;
  const s=ownSlot();if(!draft||draft.slot!==slotId)draft={slot:slotId,champion:s?.championId??'arfeli',skills:[...(s?.skills.length?s.skills:catalog[s?.championId??'arfeli'].skills.slice(0,4).map(a=>a.id))],dirty:false};
  if(!draft.dirty&&s?.championId){draft.champion=s.championId;draft.skills=[...s.skills];}
}
function slotChooser(){return ownSlots().length>1?`<label>Slot que controlás <select id="slot">${ownSlots().map(s=>`<option ${s.id===slotId?'selected':''}>${s.id}</option>`).join('')}</select></label>`:'';}
function preparation(){
  setupDraft();const s=ownSlot(),locked=Boolean(s?.ready);
  return `<div class="grid"><section class="panel"><h2>Elegí tu campeón</h2>${slotChooser()}<div class="selection">${Object.entries(catalog).map(([id,c])=>{
    const d=championDefinitions()[id];return `<button class="champion ${draft.champion===id?'chosen':''}" data-champion="${id}" ${locked||blocked()?'disabled':''}><img src="../assets/champions/${id}/${id}-avatar.png" alt=""><span>${c.name}<small>${d.hp} PV · ${d.pm} PM · Ini ${d.initiative}</small></span></button>`;
  }).join('')}</div><p>Elegí cuatro habilidades para la partida. Arfeli, Coloso, Piplus, Onod y Korgan tienen habilitadas sus seis habilidades y acciones propias. Hougan se incorporará después.</p><div class="skills">${catalog[draft.champion].skills.map(a=>`<label><input type="checkbox" data-skill="${a.id}" ${draft.skills.includes(a.id)?'checked':''} ${locked||blocked()?'disabled':''}>${escape(a.name)}</label>`).join('')}</div><div class="row"><button class="primary" data-action="ready" ${blocked()||draft.skills.length!==4?'disabled':''}>${locked?'Quitar listo':'Guardar y marcar listo'}</button><span class="phase-text">${draft.skills.length}/4 seleccionadas</span></div></section><aside class="panel"><h2>Preparación</h2>${teams()}<p>Cuando ambos estén listos pasarán al despliegue.</p><input class="link-field" value="${escape(link())}" readonly aria-label="Enlace de sala"></aside></div>`;
}
const key=p=>`${p.x},${p.y}`;
function blocked(){return joining||game.busy||!game.online||Boolean(game.sync.pendingCommand());}
function arena(){
  setupDraft();
  return slotChooser()+renderArena({state:game.state,actor,slotId,preview:game.preview,blocked:blocked(),canMove:canMove(),remaining:game.remaining(),hudCollapsed,abilitySelection});
}
function render(force=false){
  if(abilitySelection && (!canMove() || abilitySelection.unitId!==activeUnit()?.id || abilitySelection.version!==game.state?.version)) abilitySelection=null;
  motion.receive(game.state,{connected:game.online,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches});
  document.body.classList.toggle('in-arena',Boolean(game.state&&game.state.phase!=='preparation'));
  const indicator=document.querySelector('#connection');indicator.textContent=game.state?(game.sync.pendingCommand()?'Acción pendiente':game.online?'Conectado al Lab':'Sin conexión'):'Supabase Lab';indicator.classList.toggle('offline',!game.online);
  const signature=JSON.stringify([game.state?.version,joining,game.busy,game.online,game.sync.pendingCommand()?.status,game.preview,draft,slotId,abilitySelection]);
  if(!force&&signature===lastRendered){remaining();return;}lastRendered=signature;
  if(!game.state){app.innerHTML=`<section class="panel welcome"><span class="tag">Prueba LIVE v2 · 1v1</span><h2>Dos celulares, una partida</h2><p>Creá una sala y compartí su enlace. Cada celular controlará un campeón.</p><button class="primary" data-action="create" ${joining?'disabled':''}>${joining?'Conectando…':'Crear sala'}</button><form class="join-form" id="join"><input type="text" id="room" placeholder="Pegá el enlace o identificador de sala" aria-label="Enlace de sala"><button ${joining?'disabled':''}>Unirme</button></form><p class="phase-text">Se conserva tu sesión en este navegador para reconectar.</p></section>`;return;}
  app.innerHTML=roomBar()+(game.state.phase==='preparation'?preparation():arena());
  motion.paint(app);
}
async function send(type,args){try{const confirmed=await game.send(type,args);await game.refresh();return confirmed;}catch(error){notify(error.message);return false;}}
async function tapCell(x,y){
  if(blocked())return;
  if(game.state.phase==='deployment'){await send('setPosition',{slotId:ownSlot().id,position:{x,y}});return;}
  if(!canMove())return;
  const unit=activeUnit(),selected=game.preview;
  if(abilitySelection){
    const id=abilitySelection.abilityId??'sword';
    if(['trap_spikes','trap_mine','grenade','hunterstep'].includes(id)){
      const cells=id==='hunterstep'?hunterStepDestinations(game.state.combat,unit.id):id==='grenade'?korganGrenadeDestinations(game.state.combat,unit.id):korganTrapDestinations(game.state.combat,unit.id,id);
      if(!cells.some(p=>p.x===x&&p.y===y))return;
      if(abilitySelection.position?.x===x&&abilitySelection.position?.y===y){await send('ability',{slotId:unit.id,expectedTurn:game.state.turnSerial,abilityId:id,position:{x,y}});abilitySelection=null;}else abilitySelection.position={x,y};
      render(true);return;
    }
    if(id==='korganDisarm'){
      const targets=korganDisarmTargets(game.state.combat,unit.id),trap=game.state.combat.traps.find(t=>targets.includes(t.id)&&t.x===x&&t.y===y);
      if(!trap)return;
      await send('korganAction',{slotId:unit.id,expectedTurn:game.state.turnSerial,action:'disarm',targetId:trap.id});abilitySelection=null;render(true);return;
    }
    if(id==='hook'){
      const valid=abilityTargets(game.state.combat,unit.id,id),target=game.state.combat.units.find(t=>valid.includes(t.id)&&t.x===x&&t.y===y);
      if(!target)return;
      abilitySelection.targetId=target.id;abilitySelection.distance=null;render(true);return;
    }
    if(['germinate','vines'].includes(id)){
      const cells=id==='germinate'?germinateDestinations(game.state.combat,unit.id):vinesDestinations(game.state.combat,unit.id);if(!cells.some(p=>p.x===x&&p.y===y))return;
      if(abilitySelection.position?.x===x&&abilitySelection.position?.y===y){await send(id==='germinate'?'onodAction':'ability',{slotId:unit.id,expectedTurn:game.state.turnSerial,...(id==='germinate'?{action:'germinate'}:{abilityId:id}),position:{x,y}});abilitySelection=null;}else abilitySelection.position={x,y};render(true);return;
    }
    if(id==='wither'){
      const targets=onodActionTargets(game.state.combat,unit.id,'wither'),target=game.state.combat.objects.find(s=>targets.includes(s.id)&&s.x===x&&s.y===y);if(!target)return;
      if(abilitySelection.targetId===target.id){await send('onodAction',{slotId:unit.id,expectedTurn:game.state.turnSerial,action:'wither',targetId:target.id});abilitySelection=null;}else abilitySelection.targetId=target.id;render(true);return;
    }
    if(id==='impulse'){
      if(!impulseDestinations(game.state.combat,unit.id).some(p=>p.x===x&&p.y===y))return;
      if(abilitySelection.position?.x===x&&abilitySelection.position?.y===y){await send('ability',{slotId:unit.id,expectedTurn:game.state.turnSerial,abilityId:id,position:{x,y}});abilitySelection=null;}else abilitySelection.position={x,y};render(true);return;
    }
    if(id==='piplusMark'){
      const valid=piplusMarkTargets(game.state.combat,unit.id),target=game.state.combat.units.find(t=>valid.includes(t.id)&&t.x===x&&t.y===y);if(!target)return;
      if(abilitySelection.targetId===target.id){await send('piplusMark',{slotId:unit.id,expectedTurn:game.state.turnSerial,targetId:target.id});abilitySelection=null;}else abilitySelection.targetId=target.id;render(true);return;
    }
    if(id==='createPillar'){
      if(!pillarAvailable(game.state.combat,unit.id).some(p=>p.x===x&&p.y===y))return;
      if(abilitySelection.position?.x===x&&abilitySelection.position?.y===y){await send('createPillar',{slotId:unit.id,expectedTurn:game.state.turnSerial,position:{x,y}});abilitySelection=null;}else abilitySelection.position={x,y};render(true);return;
    }
    if(['fusion','recycle'].includes(id)){
      const valid=colosoActionTargets(game.state.combat,unit.id,id),target=game.state.combat.objects.find(p=>valid.includes(p.id)&&p.x===x&&p.y===y);if(!target)return;
      if(abilitySelection.targetId===target.id){await send('colosoAction',{slotId:unit.id,expectedTurn:game.state.turnSerial,action:id,targetId:target.id});abilitySelection=null;}else abilitySelection.targetId=target.id;render(true);return;
    }
    if(id==='collapse'&&abilitySelection.targetId){
      const pillar=game.state.combat.objects.find(p=>p.id===abilitySelection.targetId),direction={x:x-pillar.x,y:y-pillar.y};if(Math.abs(direction.x)+Math.abs(direction.y)!==1)return;
      if(abilitySelection.direction?.x===direction.x&&abilitySelection.direction?.y===direction.y){await send('ability',{slotId:unit.id,expectedTurn:game.state.turnSerial,abilityId:id,targetId:pillar.id,direction});abilitySelection=null;}else abilitySelection.direction=direction;render(true);return;
    }
    if(id==='magnetism'&&abilitySelection.targetId){
      const valid=magnetismTargets(game.state.combat,unit.id,abilitySelection.targetId),target=game.state.combat.units.find(p=>valid.includes(p.id)&&p.x===x&&p.y===y);if(!target)return;
      if(abilitySelection.secondaryTargetId===target.id){await send('ability',{slotId:unit.id,expectedTurn:game.state.turnSerial,abilityId:id,targetId:abilitySelection.targetId,secondaryTargetId:target.id});abilitySelection=null;}else abilitySelection.secondaryTargetId=target.id;render(true);return;
    }
    const valid=abilityTargets(game.state.combat,unit.id,id);
    const target=[...game.state.combat.units,...game.state.combat.objects].find(u=>valid.includes(u.id)&&u.x===x&&u.y===y);
    if(!target){notify('Elegí una casilla de objetivo marcada.');return;}
    if(!['collapse','magnetism'].includes(id)&&abilitySelection.targetId===target.id){await send('ability',{slotId:unit.id,expectedTurn:game.state.turnSerial,abilityId:id,targetId:target.id});abilitySelection=null;render(true);return;}
    abilitySelection.targetId=target.id;render(true);return;
  }
  if(selected&&key(selected.path.at(-1))===`${x},${y}`){
    await send('move',{slotId:unit.id,expectedTurn:game.state.turnSerial,path:selected.path});return;
  }
  try{const path=calculatePath(game.state.combat,unit.id,{x,y});if(path.length<2){game.preview=null;render(true);return;}
    const preview=previewPath(game.state.combat,unit.id,path);if(preview.lethal){notify('LETHAL_TACKLE');game.preview=null;render(true);return;}game.preview={...preview,path};render(true);
  }catch(error){game.preview=null;notify(errors[error.code]??'Esa casilla no está disponible.');render(true);}
}
app.addEventListener('submit',event=>{if(event.target.id==='join'){event.preventDefault();try{enter(roomId(document.querySelector('#room').value));}catch(error){notify(error.message);}}});
app.addEventListener('change',event=>{
  if(event.target.id==='slot'){slotId=event.target.value;draft=null;game.preview=null;render(true);}
  if(event.target.dataset.skill){const id=event.target.dataset.skill;draft.skills=event.target.checked?[...draft.skills,id]:draft.skills.filter(s=>s!==id);draft.dirty=true;render(true);}
});
app.addEventListener('click',async event=>{
  const target=event.target.closest('[data-action],[data-champion],[data-x]');if(!target||target.disabled)return;
  if(target.dataset.x!=null){await tapCell(Number(target.dataset.x),Number(target.dataset.y));return;}
  if(target.dataset.champion){draft={slot:slotId,champion:target.dataset.champion,skills:catalog[target.dataset.champion].skills.slice(0,4).map(a=>a.id),dirty:true};render(true);return;}
  switch(target.dataset.action){
    case 'exit':if(canMove()&&!blocked())await send('colosoAction',{slotId:activeUnit().id,expectedTurn:game.state.turnSerial,action:'exit',targetId:activeUnit().id});break;
    case 'korganDisarm':if(canMove()&&!blocked()){abilitySelection=abilitySelection?.abilityId==='korganDisarm'?null:{abilityId:'korganDisarm',unitId:activeUnit().id,version:game.state.version,targetId:null};game.preview=null;render(true);}break;
    case 'hookPull1':case 'hookPull2':if(canMove()&&!blocked()&&abilitySelection?.abilityId==='hook'&&abilitySelection.targetId){const distance=target.dataset.action==='hookPull2'?2:1;abilitySelection.distance=distance;render(true);await send('ability',{slotId:activeUnit().id,expectedTurn:game.state.turnSerial,abilityId:'hook',targetId:abilitySelection.targetId,distance});abilitySelection=null;render(true);}break;
    case 'trap_spikes':case 'trap_mine':case 'grenade':case 'shot':case 'hook':case 'hunterstep':case 'germinate':case 'wither':case 'thorn':case 'vines':case 'sap':case 'spores':case 'awakening':case 'reabsorption':case 'piplusMark':case 'precise':case 'vector':case 'impulse':case 'interference':case 'rupture':case 'fixation':case 'fusion':case 'recycle':case 'bow':case 'stonearmor':case 'absorb':case 'collapse':case 'magnetism':case 'createPillar':case 'hammer':case 'sword':case 'daggers':case 'shield':case 'spear':case 'quake':case 'rock':if(canMove()&&!blocked()){abilitySelection=abilitySelection?.abilityId===target.dataset.action?null:{abilityId:target.dataset.action,unitId:activeUnit().id,version:game.state.version,targetId:null};game.preview=null;render(true);}break;
    case 'moveMode':abilitySelection=null;render(true);break;
    case 'toggleHud':hudCollapsed=!hudCollapsed;render(true);break;
    case 'create':await enter(newId(),true);break;
    case 'copy':try{await navigator.clipboard.writeText(link());notify('Enlace copiado.');}catch{notify('Copiá el enlace que aparece en la sala.');}break;
    case 'ready':{
      const own=ownSlot();if(own.ready){await send('setReady',{slotId:own.id,ready:false});break;}
      if(draft.skills.length!==4)return;
      const confirmed=await send('select',{slotId:own.id,championId:draft.champion,skills:[...draft.skills]});
      const saved=game.state.slots[own.id];
      if(confirmed&&saved.championId===draft.champion&&JSON.stringify([...saved.skills].sort())===JSON.stringify([...draft.skills].sort())&&!blocked()){draft.dirty=false;await send('setReady',{slotId:own.id,ready:true});}break;
    }
    case 'confirmPosition':await send('confirmPosition',{slotId:ownSlot().id});break;
    case 'start':await send('startCombat',{});break;
    case 'end':await send('endTurn',{slotId:activeUnit().id,expectedTurn:game.state.turnSerial});break;
    case 'leave':localStorage.removeItem('live-v2-lab2-match');history.replaceState(null,'',location.pathname);location.reload();break;
  }
});
app.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)&&event.target.dataset.action==='moveMode'){event.preventDefault();abilitySelection=null;render(true);return;}if(['Enter',' '].includes(event.key)&&event.target.dataset.x!=null){event.preventDefault();tapCell(Number(event.target.dataset.x),Number(event.target.dataset.y));}});
window.addEventListener('offline',()=>game.disconnect());window.addEventListener('online',()=>game.refresh());
document.addEventListener('visibilitychange',()=>{if(document.hidden){game.preview=null;game.sync.preview=null;}else game.refresh();});
setInterval(()=>game.refresh(),1200);setInterval(()=>{remaining();},250);
render(true);
const invited=new URL(location.href).searchParams.get('match')??localStorage.getItem('live-v2-lab2-match');
if(invited){try{await enter(roomId(invited));}catch(error){notify(error.message);}}
