import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.2';
import { labUrl, publishableKey } from './lab-config.mjs';
import { catalog } from './catalog.mjs';
import { LiveSession, newId } from './session.mjs';
import { championDefinitions, movementAvailable, calculatePath, previewPath } from '../combat-core.mjs';

const client=createClient(labUrl,publishableKey,{auth:{storageKey:'live-v2-lab-auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
const app=document.querySelector('#app'),notice=document.querySelector('#notice');
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const errors={UNAUTHENTICATED:'No se pudo validar la sesión. Reintentá.',FORBIDDEN:'Esta acción no corresponde a tu controlador.',SLOT_TAKEN:'La sala ya tiene otro participante.',JOIN_CLOSED:'El combate ya empezó.',MATCH_NOT_FOUND:'No encontramos esa sala.',VERSION_CONFLICT:'La partida cambió. Actualizamos el estado.',TURN_EXPIRED:'El turno terminó.',INVALID_PATH:'Ese recorrido no es válido.',LETHAL_TACKLE:'Ese recorrido sería mortal por placaje.',INVALID_POSITION:'Elegí una casilla marcada de tu zona.',CONNECTION_PENDING:'Sin respuesta. La acción quedó pendiente; la recuperaremos al reconectar.',COMMAND_PENDING:'Esperá la confirmación de la acción anterior.'};
let notifyTimer;function notify(message){notice.textContent=errors[message]??message;notice.style.display='block';clearTimeout(notifyTimer);notifyTimer=setTimeout(()=>notice.style.display='none',6000);}
let deadlineExpired=false;
let actor=null,joining=false,draft=null,slotId=null,lastRendered='',reloading=false;
async function ensureAuth(){
  let {data:{session},error}=await client.auth.getSession();if(error)throw error;
  if(!session){const created=await client.auth.signInAnonymously();if(created.error)throw created.error;session=created.data.session;}
  if(!session)throw new Error('UNAUTHENTICATED');actor=session.user.id;return session;
}
async function api(operation,args){
  const auth=await ensureAuth(); const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);
  try{
    const response=await fetch(`${labUrl}/functions/v1/live-v2-command`,{method:'POST',headers:{authorization:`Bearer ${auth.access_token}`,apikey:publishableKey,'content-type':'application/json'},body:JSON.stringify({operation,args}),signal:controller.signal});
    const data=await response.json();if(!response.ok){const error=new Error(data.error??'SERVER_ERROR');error.definitive=response.status<500;throw error;}
    const serverTime=Number(response.headers.get('x-server-time'));
    return {data,serverTime:serverTime>0?serverTime:null};
  }finally{clearTimeout(timer);}
}
const game=new LiveSession({api,storage:localStorage,onChange:()=>render(),onError:notify});
const ownSlots=()=>Object.values(game.state?.slots??{}).filter(s=>s.controllerId===actor);
const ownSlot=()=>game.state?.slots[slotId]??ownSlots()[0];
const activeUnit=()=>game.state?.combat?.units.find(u=>u.id===game.state.combat.order[game.state.combat.turnIndex]);
const canMove=()=>game.canAct()&&activeUnit()?.controllerId===actor;
function remaining(){const expired=game.remaining()===0;if(expired!==deadlineExpired){deadlineExpired=expired;game.preview=null;render(true);return;}document.querySelector('#timer')?.replaceChildren(String(game.remaining()??'—'));if(game.remaining()===0&&game.preview){game.preview=null;render(true);}}
function link(){const url=new URL(location.href);url.search='';url.searchParams.set('match',game.state.id);return url.href;}
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
  }).join('')}</div><p>Elegí cuatro habilidades para la partida. En esta prueba se guarda la selección; todavía no se ejecutan.</p><div class="skills">${catalog[draft.champion].skills.map(a=>`<label><input type="checkbox" data-skill="${a.id}" ${draft.skills.includes(a.id)?'checked':''} ${locked||blocked()?'disabled':''}>${escape(a.name)}</label>`).join('')}</div><div class="row"><button class="primary" data-action="ready" ${blocked()||draft.skills.length!==4?'disabled':''}>${locked?'Quitar listo':'Guardar y marcar listo'}</button><span class="phase-text">${draft.skills.length}/4 seleccionadas</span></div></section><aside class="panel"><h2>Preparación</h2>${teams()}<p>Cuando ambos estén listos pasarán al despliegue.</p><input class="link-field" value="${escape(link())}" readonly aria-label="Enlace de sala"></aside></div>`;
}
const coord=(x,y)=>({x:260+(x-y)*20,y:30+(x+y)*10});
const key=p=>`${p.x},${p.y}`;
function board(){
  const state=game.state,own=ownSlot(),zones={A:['0,3','1,3','0,4','2,5','1,6','2,6'],B:['11,3','10,3','11,4','9,5','10,6','9,6']};
  let reachable=new Set();if(canMove()){try{reachable=new Set(movementAvailable(state.combat,activeUnit().id).map(key));}catch{}}
  const route=new Set(game.preview?.path.map(key)??[]),dest=game.preview?.path.at(-1);
  const obstacles=new Set(state.combat?.board.obstacles??['5,4','6,4','5,7','6,7']);
  let cells='';for(let y=0;y<12;y++)for(let x=0;x<12;x++){
    const p=coord(x,y),k=`${x},${y}`,zone=state.phase==='deployment'&&zones[own?.team]?.includes(k);
    const cls=['tile',obstacles.has(k)?'obstacle':'',zone?'zone':'',reachable.has(k)?'reachable':'',route.has(k)?'route':'',dest&&key(dest)===k?'destination':''].join(' ');
    cells+=`<polygon class="${cls}" points="${p.x},${p.y-10} ${p.x+20},${p.y} ${p.x},${p.y+10} ${p.x-20},${p.y}" data-x="${x}" data-y="${y}" role="button" tabindex="0" aria-label="Casilla ${x}, ${y}"><title>${x}, ${y}</title></polygon>`;
  }
  const trail=game.preview?`<polyline class="trail" points="${game.preview.path.map(p=>{const c=coord(p.x,p.y);return `${c.x},${c.y}`;}).join(' ')}"/>`:'';
  const units=state.combat?.units??Object.values(state.slots).filter(s=>s.position).map(s=>({...s,x:s.position.x,y:s.position.y,alive:true}));
  const pieces=units.filter(u=>u.alive).map(u=>{const p=coord(u.x,u.y);return `<ellipse class="marker" cx="${p.x}" cy="${p.y}" rx="16" ry="7" stroke="${u.controllerId===actor?'#64c6f2':'#f18b83'}"/><image class="champion-piece" href="../assets/champions/${u.championId}/${u.championId}-combat-down-right.png" x="${p.x-18}" y="${p.y-43}" width="36" height="48"/>`;}).join('');
  return `<div class="board-shell"><svg viewBox="0 0 520 280" aria-label="Tablero 12 por 12">${cells}${trail}${pieces}</svg></div>`;
}
function blocked(){return joining||game.busy||!game.online||Boolean(game.sync.pendingCommand());}
function arena(){
  setupDraft();const deployment=game.state.phase==='deployment',own=ownSlot(),active=activeUnit();
  const isCreator=game.state.creatorId===actor,allConfirmed=Object.values(game.state.slots).every(s=>s.confirmed);
  const preview=game.preview;
  const message=deployment?(own?.position?`Posición ${own.position.x}, ${own.position.y}. Podés cambiarla tocando otra casilla marcada.`:'Tocá una casilla marcada de tu zona.'):
    preview?`Recorrido: ${preview.cost} PM · Placaje: ${preview.tackleDamage} PV. Tocá de nuevo la misma casilla para mover.`:
    game.state.phase==='finished'?'Combate finalizado.':active?.controllerId===actor?'Tu turno: tocá una casilla para ver el recorrido.':'Esperando el turno rival.';
  return `<div class="grid"><section class="panel">${slotChooser()}${board()}<p class="board-note">${message}</p></section><aside class="panel"><h2>${deployment?'Despliegue':game.state.phase==='finished'?'Resultado':'Combate'}</h2>${teams()}${deployment?`<p>La posición rival se revelará al comenzar.</p><button class="primary" data-action="confirmPosition" ${blocked()||!own?.position||own.confirmed?'disabled':''}>${own?.confirmed?'Posición confirmada':'Confirmar posición'}</button>${isCreator?`<button data-action="start" ${blocked()||!allConfirmed?'disabled':''}>Iniciar combate</button>`:'<p>El creador iniciará cuando ambos confirmen.</p>'}`:game.state.phase==='finished'?`<p>Ganó el equipo ${escape(game.state.result?.winnerTeam??'—')}.</p>`:`<div class="turn row spread"><span>Ronda ${game.state.combat.round}</span><strong class="timer" id="timer">${game.remaining()}</strong></div><p>Slot activo: ${escape(active?.id)}</p><button class="primary" data-action="end" ${blocked()||!canMove()?'disabled':''}>Terminar turno</button>`}<input class="link-field" value="${escape(link())}" readonly aria-label="Enlace de sala"><p class="phase-text" id="pending">${game.sync.pendingCommand()?'Acción pendiente. Esperando confirmación…':!game.online?'Sin conexión. El turno sigue corriendo.':'Estado confirmado'}</p></aside></div>`;
}
function render(force=false){
  const indicator=document.querySelector('#connection');indicator.textContent=game.state?(game.sync.pendingCommand()?'Acción pendiente':game.online?'Conectado al Lab':'Sin conexión'):'Supabase Lab';indicator.classList.toggle('offline',!game.online);
  const signature=JSON.stringify([game.state?.version,joining,game.busy,game.online,game.sync.pendingCommand()?.status,game.preview,draft,slotId]);
  if(!force&&signature===lastRendered){remaining();return;}lastRendered=signature;
  if(!game.state){app.innerHTML=`<section class="panel welcome"><span class="tag">Prueba LIVE v2 · 1v1</span><h2>Dos celulares, una partida</h2><p>Creá una sala y compartí su enlace. Cada celular controlará un campeón.</p><button class="primary" data-action="create" ${joining?'disabled':''}>${joining?'Conectando…':'Crear sala'}</button><form class="join-form" id="join"><input type="text" id="room" placeholder="Pegá el enlace o identificador de sala" aria-label="Enlace de sala"><button ${joining?'disabled':''}>Unirme</button></form><p class="phase-text">Se conserva tu sesión en este navegador para reconectar.</p></section>`;return;}
  app.innerHTML=roomBar()+(game.state.phase==='preparation'?preparation():arena());
}
async function send(type,args){try{const confirmed=await game.send(type,args);await game.refresh();return confirmed;}catch(error){notify(error.message);return false;}}
async function tapCell(x,y){
  if(blocked())return;
  if(game.state.phase==='deployment'){await send('setPosition',{slotId:ownSlot().id,position:{x,y}});return;}
  if(!canMove())return;
  const unit=activeUnit(),selected=game.preview;
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
    case 'leave':localStorage.removeItem('live-v2-lab-match');history.replaceState(null,'',location.pathname);location.reload();break;
  }
});
app.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)&&event.target.dataset.x!=null){event.preventDefault();tapCell(Number(event.target.dataset.x),Number(event.target.dataset.y));}});
window.addEventListener('offline',()=>game.disconnect());window.addEventListener('online',()=>game.refresh());
document.addEventListener('visibilitychange',()=>{if(document.hidden){game.preview=null;game.sync.preview=null;}else game.refresh();});
setInterval(()=>game.refresh(),1200);setInterval(()=>{remaining();},250);
render(true);
const invited=new URL(location.href).searchParams.get('match')??localStorage.getItem('live-v2-lab-match');
if(invited){try{await enter(roomId(invited));}catch(error){notify(error.message);}}
