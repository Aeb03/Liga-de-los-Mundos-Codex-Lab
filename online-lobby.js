(()=>{'use strict';
const CFG=()=>window.LIGA_ONLINE_CONFIG||{};
const PROTOCOL_VERSION=Number(CFG().protocolVersion)||1;
const PLAYER_KEY='liga-online-player-id-v1';
let session=null,socket=null,heartbeat=null,syncTimer=null,refreshing=false,ref=0,serverClockOffsetMs=0;
const app=()=>document.getElementById('app');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const playerId=()=>{let id=localStorage.getItem(PLAYER_KEY);if(!id){id=(crypto.randomUUID?.()||`p-${Date.now()}-${Math.random().toString(36).slice(2)}`);localStorage.setItem(PLAYER_KEY,id)}return id};
const readyConfig=()=>{const c=CFG();return /^https:\/\//.test(c.supabaseUrl||'')&&!String(c.supabaseUrl).includes('PEGAR_')&&c.publishableKey&&!String(c.publishableKey).includes('PEGAR_')};
const base=()=>String(CFG().supabaseUrl||'').replace(/\/$/,'');
const headers=(extra={})=>({'apikey':CFG().publishableKey,'Authorization':`Bearer ${CFG().publishableKey}`,'Content-Type':'application/json',...extra});
function captureServerClock(r){const raw=r?.headers?.get?.('date');const ms=raw?Date.parse(raw):NaN;if(Number.isFinite(ms))serverClockOffsetMs=ms-Date.now()}
const serverNowIso=()=>new Date(Date.now()+serverClockOffsetMs).toISOString();
async function api(path,opt={}){const r=await fetch(base()+path,{...opt,headers:headers(opt.headers||{})});captureServerClock(r);if(!r.ok){let m='';try{m=await r.text()}catch(_){}throw new Error(`${r.status} ${m||r.statusText}`)}if(r.status===204)return null;const t=await r.text();return t?JSON.parse(t):null}
function errorText(e){const raw=String(e?.message||e||'Error desconocido');try{const i=raw.indexOf('{');if(i>=0){const j=JSON.parse(raw.slice(i));const parts=[j.code,j.message,j.details,j.hint].filter(Boolean);if(parts.length)return parts.join(' · ')}}catch(_){}return raw.replace(/sb_publishable_[A-Za-z0-9_-]+/g,'sb_publishable_[oculta]')}
const code=()=>{const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';return Array.from({length:6},()=>a[Math.floor(Math.random()*a.length)]).join('')};
const roster=()=>window.LigaOnlineGame?.roster?.()||[];
const champion=id=>roster().find(c=>c.id===id)||null;
const ONLINE_BASIC_ABILITIES={
  arfeli:new Set(['sword','daggers','bow','shield']),
  piplus:new Set(['precise']),
  onod:new Set(['sap']),
  korgan:new Set(['shot'])
};
const onlineBasicAbilityAllowed=(championId,id)=>!!ONLINE_BASIC_ABILITIES[championId]?.has(id);
const validLoadout=(championId,list)=>{const c=champion(championId);if(!c)return[];const ids=new Set(c.abilities.map(a=>a.id));return Array.isArray(list)?list.filter(x=>ids.has(x)).slice(0,4):[]};
function shell(body){app().innerHTML=`<section class="screen online-screen"><div class="topbar"><b>🌐 1v1 ONLINE · MOVIMIENTO + HABILIDADES BÁSICAS</b><span>Protocolo ${PROTOCOL_VERSION}</span></div>${body}</section>`}
function home(msg=''){
  cleanupRealtime();session=null;
  shell(`<div class="online-card"><small>PRUEBA ONLINE v0.6.41</small><h2>1 PLAYER vs 1 PLAYER</h2><p>Amplía el canal validado con Dagas Danzantes + Herida, Savia Vital y Disparo de Caza, manteniendo las habilidades básicas ya aprobadas.</p>${msg?`<div class="online-message">${esc(msg)}</div>`:''}<div class="online-actions"><button id="onlineCreate">CREAR PARTIDA</button><div class="online-join"><input id="onlineCode" maxlength="6" autocomplete="off" placeholder="CÓDIGO"><button id="onlineJoin">UNIRSE</button></div></div><div class="online-status ${readyConfig()?'ok':'warn'}">${readyConfig()?'Supabase configurado · listo para probar':'Falta configurar Project URL + Publishable key'}</div></div><div class="actions"><button class="secondary" id="onlineBack">Volver</button></div>`);
  document.getElementById('onlineCreate').onclick=createMatch;
  document.getElementById('onlineJoin').onclick=()=>joinMatch(document.getElementById('onlineCode').value);
  document.getElementById('onlineCode').oninput=e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);
  document.getElementById('onlineBack').onclick=()=>window.LigaOnlineBack?.();
}
function localSlot(){return session?.slots?.find(s=>s.player_id===playerId())||session?.slots?.find(s=>s.team===session?.team)||null}
function rivalSlot(){return session?.slots?.find(s=>s.team!==session?.team)||null}
function slotReady(s){return !!(s?.ready&&champion(s.champion_id)&&validLoadout(s.champion_id,s.loadout).length===4)}
function deploymentReady(s){return !!(s?.deployment_ready&&Number.isInteger(s.deploy_x)&&Number.isInteger(s.deploy_y)&&s.deploy_x>=0&&s.deploy_x<12&&s.deploy_y>=0&&s.deploy_y<12)}
function participant(s){return s?{team:s.team,slotNumber:Number(s.slot_number)||1,controller:s.controller||'PLAYER',playerId:s.player_id||null,championId:s.champion_id,loadout:validLoadout(s.champion_id,s.loadout),deploymentReady:deploymentReady(s),x:deploymentReady(s)?s.deploy_x:null,y:deploymentReady(s)?s.deploy_y:null}:null}
function ensureChoice(){
  // v0.6.35h7: conservar selección parcial 0–4 durante edición.
  if(session?.choice&&champion(session.choice.championId)){
    session.choice.loadout=validLoadout(session.choice.championId,session.choice.loadout);
    return session.choice;
  }
  const stored=localSlot();
  if(stored?.champion_id&&champion(stored.champion_id)){
    const v=validLoadout(stored.champion_id,stored.loadout);
    if(v.length===4){session.choice={championId:stored.champion_id,loadout:v};return session.choice}
  }
  const d=window.LigaOnlineGame?.defaultSelection?.()||{};
  const first=champion(d.championId)||roster()[0];
  if(!first)return null;
  const dl=validLoadout(first.id,d.loadout);
  session.choice={championId:first.id,loadout:dl.length===4?dl:first.abilities.slice(0,4).map(a=>a.id)};
  return session.choice;
}
function waiting(){
  shell(`<div class="online-card online-room"><small>SALA ONLINE</small><div class="room-code">${esc(session.roomCode)}</div><p>En el otro dispositivo ingresá este código.</p><div class="rival-state waiting"><b>ESPERANDO RIVAL</b><small>Sincronización activa · aguardando Equipo ${session.team==='A'?'B':'A'} / Slot 1</small></div><div class="online-slots"><span>Equipo A · Slot 1 <b>${session.team==='A'?'VOS':'VACÍO'}</b></span><span>Equipo B · Slot 1 <b>${session.team==='B'?'VOS':'VACÍO'}</b></span></div></div><div class="actions"><button class="secondary" id="onlineLeave">Abandonar sala</button></div>`);
  document.getElementById('onlineLeave').onclick=leave;
}
function schemaProblem(){
  shell(`<div class="online-card"><small>SALA ${esc(session?.roomCode||'')}</small><h2>Falta actualizar Supabase</h2><div class="online-message">Esta versión necesita las migraciones previas y habilitar el tipo de acción <b>ability</b>. Si v0.6.38 ya funciona, ejecutá solamente <b>supabase-online-v0639.sql</b> una vez.</div></div><div class="actions"><button class="secondary" id="onlineLeave">Abandonar sala</button></div>`);
  document.getElementById('onlineLeave').onclick=leave;
}
function prep(){
  const choice=ensureChoice();if(!choice)return home('No se pudo leer el plantel de campeones.');
  const c=champion(choice.championId),mine=localSlot(),other=rivalSlot(),mineReady=slotReady(mine),otherReady=slotReady(other);
  const cards=roster().map(x=>`<button class="online-champ-card ${x.id===choice.championId?'selected':''}" data-online-champ="${x.id}" ${mineReady?'disabled':''}><span class="champ-icon">${x.icon}</span><b>${esc(x.name)}</b><small>${esc(x.role)}</small></button>`).join('');
  const abilities=c.abilities.map(a=>`<button class="online-skill ${choice.loadout.includes(a.id)?'selected':''}" data-online-skill="${a.id}" ${mineReady?'disabled':''}><span>${a.icon}</span><div><b>${esc(a.name)}</b><small>${a.cost} PA</small></div>${choice.loadout.includes(a.id)?'<em>✓</em>':''}</button>`).join('');
  const rivalChamp=champion(other?.champion_id);
  shell(`<div class="online-prep-wrap">
    <div class="online-room-bar"><div><small>SALA</small><b>${esc(session.roomCode)}</b></div><span class="online-device-team">VOS · EQUIPO ${esc(session.team)}</span><div class="online-ready-pair"><span class="${mineReady?'is-ready':''}">Vos ${mineReady?'LISTO':'NO LISTO'}</span><span class="${otherReady?'is-ready':''}">Rival ${otherReady?'LISTO':'NO LISTO'}</span></div></div>
    <div class="online-prep-grid">
      <div class="online-picker-panel"><h3>Elegí tu campeón</h3><div class="online-champ-grid">${cards}</div><div class="online-selected-detail"><b>${c.icon} ${esc(c.name)}</b><span>❤️ ${c.hp} · PA ${c.pa} · PM ${c.pm} · ⚡ ${c.ini}</span><small>${esc(c.passive?.name||'')} · ${esc(c.passive?.text||'')}</small></div></div>
      <div class="online-picker-panel"><h3>Elegí 4 habilidades</h3><div class="online-count">${choice.loadout.length}/4</div><div class="online-skill-grid">${abilities}</div></div>
      <div class="online-rival-panel"><small>RIVAL CONECTADO · EQUIPO ${session.team==='A'?'B':'A'}</small><div class="online-rival-avatar">${rivalChamp?rivalChamp.icon:'?'}</div><b>${rivalChamp?esc(rivalChamp.name):(otherReady?'Selección inválida':'Preparando equipo…')}</b><span class="online-rival-ready ${otherReady?'is-ready':''}">${otherReady?'LISTO':'NO LISTO'}</span><p>${mineReady?(otherReady?'Los dos están listos. Entrando al despliegue…':'Tu selección quedó bloqueada. Esperando al rival.'):'Confirmá tu selección cuando tengas exactamente 4 habilidades.'}</p></div>
    </div>
  </div><div class="actions"><button class="secondary" id="onlineLeave">Abandonar sala</button>${mineReady?'<button id="onlineEdit">CAMBIAR SELECCIÓN</button>':`<button id="onlineReady" ${choice.loadout.length===4?'':'disabled'}>ESTOY LISTO</button>`}</div>`);
  document.getElementById('onlineLeave').onclick=leave;
  document.getElementById('onlineEdit')?.addEventListener('click',()=>setReady(false));
  document.getElementById('onlineReady')?.addEventListener('click',()=>setReady(true));
  document.querySelectorAll('[data-online-champ]').forEach(b=>b.onclick=()=>{if(mineReady)return;const next=champion(b.dataset.onlineChamp);if(!next)return;session.choice={championId:next.id,loadout:next.abilities.slice(0,4).map(a=>a.id)};prep()});
  document.querySelectorAll('[data-online-skill]').forEach(b=>b.onclick=()=>{if(mineReady)return;const id=b.dataset.onlineSkill;let list=[...choice.loadout];if(list.includes(id))list=list.filter(x=>x!==id);else if(list.length<4)list.push(id);session.choice={championId:choice.championId,loadout:list};prep()});
}
function renderRoom(){
  if(!session)return home();
  if(session.schemaError)return schemaProblem();
  const rival=!!rivalSlot();session.rival=rival;
  if(!rival)return waiting();
  const a=session.slots.find(s=>s.team==='A'),b=session.slots.find(s=>s.team==='B');
  if(slotReady(a)&&slotReady(b))return launchDeployment(a,b);
  prep();
}
async function createMatch(){if(!readyConfig())return home('Configurá Supabase antes de crear una sala.');let createdMatchId=null;try{home('Creando sala…');let room,rows;for(let i=0;i<5;i++){room=code();try{rows=await api('/rest/v1/online_matches',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({room_code:room,status:'waiting',team_size:1,protocol_version:PROTOCOL_VERSION})});break}catch(e){if(/^409\b/.test(String(e?.message||''))&&i<4)continue;throw e}}const match=rows?.[0];if(!match?.id)throw new Error('Supabase no devolvió el id de la partida');createdMatchId=match.id;await api('/rest/v1/online_slots',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({match_id:match.id,team:'A',slot_number:1,controller:'PLAYER',player_id:playerId(),ready:false})});session={matchId:match.id,roomCode:room,team:'A',rival:false,slots:[],choice:null,phase:'room',schemaError:false,lastActionSeq:0,actionSending:false};subscribe();await refresh()}catch(e){console.error('Online create',e);if(createdMatchId){api(`/rest/v1/online_matches?id=eq.${encodeURIComponent(createdMatchId)}`,{method:'DELETE',headers:{Prefer:'return=minimal'}}).catch(()=>{})}home(`Error Supabase al crear sala: ${errorText(e)}`)}}
async function joinMatch(raw){const room=String(raw||'').trim().toUpperCase();if(!readyConfig())return home('Configurá Supabase antes de unirte.');if(room.length<4)return home('Ingresá el código de sala.');try{home('Buscando sala…');const ms=await api(`/rest/v1/online_matches?room_code=eq.${encodeURIComponent(room)}&protocol_version=eq.${PROTOCOL_VERSION}&select=id,room_code,status,team_size,protocol_version&limit=1`);const m=ms?.[0];if(!m)throw new Error('Sala inexistente o incompatible');const slots=await api(`/rest/v1/online_slots?match_id=eq.${encodeURIComponent(m.id)}&team=eq.B&slot_number=eq.1&select=id,player_id&limit=1`);if(slots?.length&&slots[0].player_id!==playerId())throw new Error('La sala ya tiene rival');if(!slots?.length)await api('/rest/v1/online_slots',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({match_id:m.id,team:'B',slot_number:1,controller:'PLAYER',player_id:playerId(),ready:false})});await api(`/rest/v1/online_matches?id=eq.${encodeURIComponent(m.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'connected',updated_at:new Date().toISOString()})});session={matchId:m.id,roomCode:m.room_code,team:'B',rival:true,slots:[],choice:null,phase:'room',schemaError:false,lastActionSeq:0,actionSending:false};subscribe();await refresh()}catch(e){console.error('Online join',e);home(e.message.includes('incompatible')?'Sala inexistente o de otra versión.':`Error Supabase al unirse: ${errorText(e)}`)}}
async function setReady(value){if(!session)return;const choice=ensureChoice();if(value&&(!choice||choice.loadout.length!==4))return prep();try{const payload=value?{champion_id:choice.championId,loadout:choice.loadout,ready:true,deployment_ready:false,deploy_x:null,deploy_y:null}:{ready:false,deployment_ready:false,deploy_x:null,deploy_y:null};await api(`/rest/v1/online_slots?match_id=eq.${encodeURIComponent(session.matchId)}&player_id=eq.${encodeURIComponent(playerId())}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(payload)});await refresh()}catch(e){console.error('Online ready',e);session.schemaError=/champion_id|loadout|deploy_|deployment_ready|column|schema cache/i.test(e.message);if(session.schemaError)schemaProblem();else prep()}}
async function confirmDeployment(pos={}){if(!session||session.phase!=='deployment')return false;const x=Number(pos.x),y=Number(pos.y);if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||x>=12||y<0||y>=12)return false;try{await api(`/rest/v1/online_slots?match_id=eq.${encodeURIComponent(session.matchId)}&player_id=eq.${encodeURIComponent(playerId())}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({deploy_x:x,deploy_y:y,deployment_ready:true})});await refresh();return true}catch(e){console.error('Online deployment',e);session.schemaError=/deploy_|deployment_ready|column|schema cache/i.test(e.message);if(session.schemaError)schemaProblem();else window.LigaOnlineGame?.deploymentError?.(errorText(e));return false}}
function launchDeployment(a,b){
  if(!session)return;
  const participants=[participant(a),participant(b)].filter(Boolean);
  if(participants.some(p=>!p.championId||p.loadout.length!==4))return;
  if(session.phase==='round-ready'||session.phase==='turn-authority')return;
  if(session.phase!=='deployment'){
    session.phase='deployment';
    if(session.team==='A')api(`/rest/v1/online_matches?id=eq.${encodeURIComponent(session.matchId)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'deployment',updated_at:new Date().toISOString()})}).catch(()=>{});
    const ok=window.LigaOnlineGame?.startDeployment?.({roomCode:session.roomCode,localTeam:session.team,localPlayerId:playerId(),participants});
    if(!ok){session.phase='room';session.schemaError=true;return renderRoom()}
  }
  syncDeployment(a,b);
}
function syncDeployment(a,b){
  if(!session||session.phase!=='deployment')return;
  const participants=[participant(a),participant(b)].filter(Boolean);
  window.LigaOnlineGame?.syncDeployment?.({roomCode:session.roomCode,localTeam:session.team,localPlayerId:playerId(),participants});
  if(participants.length===2&&participants.every(p=>p.deploymentReady))launchRoundReady(participants);
}
function turnOrder(participants){
  return [...participants].sort((a,b)=>(champion(b.championId)?.ini||0)-(champion(a.championId)?.ini||0)||String(a.team).localeCompare(String(b.team))||a.slotNumber-b.slotNumber);
}
async function initializeTurnAuthority(participants){
  if(!session||session.team!=='A'||session.initializingAuthority)return;
  const first=turnOrder(participants)[0];if(!first)return;
  session.initializingAuthority=true;
  try{
    await api(`/rest/v1/online_matches?id=eq.${encodeURIComponent(session.matchId)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'turn_authority',round_number:1,turn_index:0,turn_seq:1,active_team:first.team,active_slot:first.slotNumber,turn_started_at:serverNowIso(),updated_at:serverNowIso()})});
  }catch(e){console.error('Online authority init',e);session.schemaError=/round_number|turn_index|turn_seq|active_team|active_slot|turn_started_at|column|schema cache/i.test(e.message);if(session.schemaError)schemaProblem()}
  finally{session.initializingAuthority=false}
}
function syncTurnAuthority(match,participants){
  if(!session||!match||match.status!=='turn_authority')return false;
  const activeTeam=String(match.active_team||''),activeSlot=Number(match.active_slot);
  if(!activeTeam||!Number.isInteger(activeSlot)||activeSlot<1)return false;
  session.phase='turn-authority';
  window.LigaOnlineGame?.syncTurnAuthority?.({roomCode:session.roomCode,localTeam:session.team,localPlayerId:playerId(),participants,roundNumber:Number(match.round_number)||1,turnIndex:Number(match.turn_index)||0,turnSeq:Number(match.turn_seq)||1,activeTeam,activeSlot,turnStartedAt:match.turn_started_at||null,clockOffsetMs:serverClockOffsetMs});
  return true;
}
function launchRoundReady(participants){
  if(!session||session.phase==='round-ready'||session.phase==='turn-authority')return;
  session.phase='round-ready';
  window.LigaOnlineGame?.startRoundReady?.({roomCode:session.roomCode,localTeam:session.team,localPlayerId:playerId(),participants});
  if(session.team==='A')initializeTurnAuthority(participants);
}

function localAuthorityParticipant(match){
  const mine=localSlot();
  if(!mine||!match)return null;
  const activeTeam=String(match.active_team||''),activeSlot=Number(match.active_slot);
  if(activeTeam!==mine.team||activeSlot!==(Number(mine.slot_number)||1)||mine.player_id!==playerId())return null;
  return participant(mine);
}
async function currentMatchState(){
  const rows=await api(`/rest/v1/online_matches?id=eq.${encodeURIComponent(session.matchId)}&select=status,round_number,turn_index,turn_seq,active_team,active_slot,turn_started_at&limit=1`);
  return rows?.[0]||null;
}
function actionRowPayload(type,turnSeq,actor,payload={},result={}){
  return {
    match_id:String(session.matchId),
    turn_seq:Number(turnSeq)||0,
    actor_team:actor.team,
    actor_slot:actor.slotNumber,
    actor_controller:actor.controller||'PLAYER',
    actor_player_id:actor.playerId||null,
    action_type:type,
    payload,
    result,
    client_action_id:(crypto.randomUUID?.()||`a-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  };
}
async function appendAction(row){
  const rows=await api('/rest/v1/online_actions',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(row)});
  return rows?.[0]||null;
}
async function syncPendingActions(actions){
  if(!session||!Array.isArray(actions)||!actions.length)return true;
  const rows=actions.filter(a=>Number(a.seq)>(Number(session.lastActionSeq)||0)).sort((a,b)=>Number(a.seq)-Number(b.seq));
  if(!rows.length)return true;
  const ok=await window.LigaOnlineGame?.syncActions?.({roomCode:session.roomCode,localTeam:session.team,localPlayerId:playerId(),actions:rows});
  if(ok===false)return false;
  session.lastActionSeq=Math.max(Number(session.lastActionSeq)||0,...rows.map(a=>Number(a.seq)||0));
  return true;
}
async function requestMove(command={}){
  if(!session||session.phase!=='turn-authority'||session.actionSending)return false;
  session.actionSending=true;
  try{
    const match=await currentMatchState();
    if(!match||match.status!=='turn_authority')return false;
    const actor=localAuthorityParticipant(match);if(!actor)return false;
    const to=command?.to||{},from=command?.from||{};
    const path=Array.isArray(command?.path)?command.path:[];
    const cost=Number(command?.cost);
    if(!Number.isInteger(to.x)||!Number.isInteger(to.y)||!Number.isInteger(from.x)||!Number.isInteger(from.y)||!Number.isInteger(cost)||cost<1)return false;
    await appendAction(actionRowPayload('move',match.turn_seq,actor,{
      from:{x:from.x,y:from.y},
      to:{x:to.x,y:to.y},
      path:path.map(p=>({x:Number(p.x),y:Number(p.y)})),
      cost
    },{
      to:{x:to.x,y:to.y},
      pmBefore:Number(command.pmBefore),
      pmAfter:Number(command.pmAfter)
    }));
    await refresh();
    return true;
  }catch(e){
    console.error('Online move',e);
    session.schemaError=/online_actions|action_type|client_action_id|actor_|column|schema cache|relation/i.test(e.message);
    if(session.schemaError)schemaProblem();else window.LigaOnlineGame?.actionError?.(errorText(e));
    return false;
  }finally{if(session)session.actionSending=false}
}
async function requestAbility(command={}){
  if(!session||session.phase!=='turn-authority'||session.actionSending){
    window.LigaOnlineGame?.actionError?.('La habilidad no pudo enviarse: sesión/fase no disponible o hay otra acción en curso.');
    return false;
  }
  session.actionSending=true;
  try{
    const match=await currentMatchState();
    if(!match||match.status!=='turn_authority')throw new Error('La partida ya no está en una fase de turno válida.');
    const actor=localAuthorityParticipant(match);if(!actor)throw new Error('Este cliente ya no tiene la autoridad del turno.');
    const abilityId=String(command?.abilityId||''),effectKind=String(command?.effectKind||'damage');
    if(!onlineBasicAbilityAllowed(actor.championId,abilityId))throw new Error('La habilidad recibida todavía no pertenece al bloque online habilitado.');
    const target=command?.target||{},actorState=command?.actor||{},expected=command?.expected||{};
    if(String(actorState.championId||'')!==actor.championId)throw new Error('El campeón actor de la habilidad no coincide con el turno activo.');
    const targetTeam=String(target.team||''),targetSlot=Number(target.slotNumber);
    if(!['A','B'].includes(targetTeam)||!Number.isInteger(targetSlot)||targetSlot<1||targetSlot>5)throw new Error('Objetivo online inválido.');
    if(effectKind==='shield'){
      if(!(actor.championId==='arfeli'&&abilityId==='shield'&&targetTeam===actor.team&&targetSlot===actor.slotNumber))throw new Error('Portación de Escudo sólo puede aplicarse a Arfeli.');
    }else if(effectKind==='damage'){
      if(targetTeam===actor.team)throw new Error('El objetivo de daño debe pertenecer al equipo rival.');
    }else if(effectKind==='heal'){
      if(!(actor.championId==='onod'&&abilityId==='sap')||targetTeam!==actor.team)throw new Error('Savia Vital sólo puede curar a Onod o a un aliado.');
    }else throw new Error('Tipo de efecto online no admitido.');
    const cost=Number(command?.cost),damage=Number(command?.damage),healAmount=Number(command?.healAmount),shieldAmount=Number(command?.shieldAmount),paBefore=Number(command?.paBefore),useBefore=Number(command?.useBefore),statusAmount=Number(command?.statusAmount);
    const row=actionRowPayload('ability',match.turn_seq,actor,{
      abilityId,effectKind,
      actor:{championId:actor.championId,x:Number(actorState.x),y:Number(actorState.y)},
      target:{team:targetTeam,slotNumber:targetSlot,x:Number(target.x),y:Number(target.y)},
      cost:Number.isFinite(cost)?cost:0,
      damage:Number.isFinite(damage)?damage:0,
      healAmount:Number.isFinite(healAmount)?healAmount:0,
      shieldAmount:Number.isFinite(shieldAmount)?shieldAmount:0,
      masteryBonus:Number(command?.masteryBonus)||0,
      statusType:String(command?.statusType||''),
      statusAmount:Number.isFinite(statusAmount)?statusAmount:0,
      paBefore:Number.isFinite(paBefore)?paBefore:0,
      useBefore:Number.isFinite(useBefore)?useBefore:0,
      targetHpBefore:Number(command?.targetHpBefore),
      targetShieldBefore:Number(command?.targetShieldBefore),
      targetAliveBefore:!!command?.targetAliveBefore,
      targetStatusBefore:Number(command?.targetStatusBefore)
    },{
      actorPaAfter:Number(expected.actorPaAfter),
      targetHpAfter:Number(expected.targetHpAfter),
      targetShieldAfter:Number(expected.targetShieldAfter),
      targetAliveAfter:!!expected.targetAliveAfter,
      targetStatusAfter:Number(expected.targetStatusAfter),
      useAfter:Number(expected.useAfter)
    });
    const saved=await appendAction(row);
    if(!saved?.seq)throw new Error('Supabase no devolvió la acción ability insertada.');
    const synced=await syncPendingActions([saved]);
    if(synced===false)throw new Error('La acción ability se guardó, pero no pudo aplicarse en el cliente emisor.');
    await refresh();
    return true;
  }catch(e){
    console.error('Online ability',e);
    session.schemaError=/online_actions|action_type|constraint|check|column|schema cache|relation/i.test(e.message);
    if(session.schemaError)schemaProblem();else window.LigaOnlineGame?.actionError?.(`Habilidad online: ${errorText(e)}`);
    return false;
  }finally{if(session)session.actionSending=false}
}
async function requestEndTurn(){
  if(!session||session.phase!=='turn-authority'||session.actionSending)return false;
  session.actionSending=true;
  try{
    const match=await currentMatchState();
    if(!match||match.status!=='turn_authority')return false;
    const actor=localAuthorityParticipant(match);if(!actor)return false;
    const participants=session.slots.map(participant).filter(Boolean);
    const order=turnOrder(participants);if(!order.length)return false;
    const currentIndex=Math.max(0,Math.min(order.length-1,Number(match.turn_index)||0));
    const nextIndex=(currentIndex+1)%order.length;
    const next=order[nextIndex];if(!next)return false;
    const currentRound=Math.max(1,Number(match.round_number)||1);
    const currentSeq=Math.max(1,Number(match.turn_seq)||1);
    const nextRound=currentRound+(nextIndex===0?1:0),nextSeq=currentSeq+1,started=serverNowIso();
    const updated=await api(`/rest/v1/online_matches?id=eq.${encodeURIComponent(session.matchId)}&turn_seq=eq.${currentSeq}&active_team=eq.${encodeURIComponent(actor.team)}&active_slot=eq.${actor.slotNumber}`,{
      method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({
        status:'turn_authority',round_number:nextRound,turn_index:nextIndex,turn_seq:nextSeq,
        active_team:next.team,active_slot:next.slotNumber,turn_started_at:started,updated_at:started
      })
    });
    if(!updated?.length)throw new Error('El turno ya cambió en el servidor.');
    try{
      await appendAction(actionRowPayload('end_turn',currentSeq,actor,{roundNumber:currentRound,turnIndex:currentIndex},{
        nextRoundNumber:nextRound,nextTurnIndex:nextIndex,nextTurnSeq:nextSeq,nextActiveTeam:next.team,nextActiveSlot:next.slotNumber,turnStartedAt:started
      }));
    }catch(e){console.warn('Online end_turn audit action',e)}
    await refresh();
    return true;
  }catch(e){
    console.error('Online end turn',e);
    session.schemaError=/online_actions|round_number|turn_index|turn_seq|active_team|active_slot|column|schema cache|relation/i.test(e.message);
    if(session.schemaError)schemaProblem();else window.LigaOnlineGame?.actionError?.(errorText(e));
    return false;
  }finally{if(session)session.actionSending=false}
}
async function refresh(){
  if(!session||refreshing)return;refreshing=true;
  try{
    const [slots,matches,actions]=await Promise.all([
      api(`/rest/v1/online_slots?match_id=eq.${encodeURIComponent(session.matchId)}&controller=eq.PLAYER&select=team,slot_number,controller,player_id,ready,champion_id,loadout,deploy_x,deploy_y,deployment_ready`),
      api(`/rest/v1/online_matches?id=eq.${encodeURIComponent(session.matchId)}&select=status,round_number,turn_index,turn_seq,active_team,active_slot,turn_started_at&limit=1`),
      api(`/rest/v1/online_actions?match_id=eq.${encodeURIComponent(String(session.matchId))}&seq=gt.${Number(session.lastActionSeq)||0}&select=seq,turn_seq,actor_team,actor_slot,actor_controller,actor_player_id,action_type,payload,result,created_at&order=seq.asc&limit=100`)
    ]);
    session.slots=slots||[];session.schemaError=false;
    const match=matches?.[0]||null;
    const a=session.slots.find(s=>s.team==='A'),b=session.slots.find(s=>s.team==='B');
    if(session.phase==='deployment'){
      if(!a||!b){session.phase='room';return renderRoom()}
      if(!slotReady(a)||!slotReady(b)){session.phase='room';return renderRoom()}
      syncDeployment(a,b);return;
    }
    if(session.phase==='round-ready'||session.phase==='turn-authority'){
      const participants=[participant(a),participant(b)].filter(Boolean);
      if(actions?.length)await syncPendingActions(actions);
      if(match?.status==='turn_authority'){syncTurnAuthority(match,participants);return}
      if(session.phase==='round-ready'&&session.team==='A'&&!session.initializingAuthority)initializeTurnAuthority(participants);
      return;
    }
    renderRoom();
  }catch(e){
    console.warn('Online refresh',e);
    session.schemaError=/champion_id|loadout|deploy_|deployment_ready|round_number|turn_index|turn_seq|active_team|active_slot|turn_started_at|online_actions|action_type|actor_|client_action_id|column|schema cache|relation/i.test(e.message);
    if(session.schemaError)return schemaProblem();
    renderRoom();
  }finally{refreshing=false}
}
function returnToRoom(){if(!session)return home();session.phase='room';renderRoom()}
function cleanupRealtime(){if(heartbeat){clearInterval(heartbeat);heartbeat=null}if(syncTimer){clearInterval(syncTimer);syncTimer=null}if(socket){try{socket.close()}catch(_){}socket=null}}
function subscribe(){
  cleanupRealtime();if(!session)return;
  // Realtime + polling REST ~900 ms: robusto en Android/LAN y evita depender de un único canal.
  syncTimer=setInterval(()=>{if(session&&!document.hidden)refresh()},900);
  const topic=`realtime:ldm-${session.matchId}`;
  const ws=base().replace(/^http/,'ws')+`/realtime/v1/websocket?apikey=${encodeURIComponent(CFG().publishableKey)}&vsn=1.0.0`;
  socket=new WebSocket(ws);
  socket.onopen=()=>{
    const joinRef=String(++ref);
    socket.send(JSON.stringify({topic,event:'phx_join',payload:{config:{broadcast:{self:false},presence:{key:''},postgres_changes:[{event:'*',schema:'public',table:'online_slots',filter:`match_id=eq.${session.matchId}`},{event:'UPDATE',schema:'public',table:'online_matches',filter:`id=eq.${session.matchId}`},{event:'INSERT',schema:'public',table:'online_actions',filter:`match_id=eq.${session.matchId}`}]},access_token:CFG().publishableKey},ref:joinRef}));
    heartbeat=setInterval(()=>{if(socket?.readyState===1)socket.send(JSON.stringify({topic:'phoenix',event:'heartbeat',payload:{},ref:String(++ref)}))},25000);
  };
  socket.onmessage=e=>{try{const m=JSON.parse(e.data);if(m.event==='postgres_changes'||m.event==='presence_state')refresh()}catch(_){}};
  socket.onclose=()=>{if(session)setTimeout(()=>{if(session)subscribe()},1500)};
  socket.onerror=e=>console.warn('Realtime',e);
}
async function leave(){const s=session;session=null;cleanupRealtime();window.LigaOnlineGame?.stopOnline?.();if(s&&readyConfig()){try{await api(`/rest/v1/online_slots?match_id=eq.${encodeURIComponent(s.matchId)}&player_id=eq.${encodeURIComponent(playerId())}`,{method:'DELETE',headers:{Prefer:'return=minimal'}});const left=await api(`/rest/v1/online_slots?match_id=eq.${encodeURIComponent(s.matchId)}&controller=eq.PLAYER&select=id&limit=1`);if(!left?.length){await api(`/rest/v1/online_actions?match_id=eq.${encodeURIComponent(String(s.matchId))}`,{method:'DELETE',headers:{Prefer:'return=minimal'}}).catch(()=>{});await api(`/rest/v1/online_matches?id=eq.${encodeURIComponent(s.matchId)}`,{method:'DELETE',headers:{Prefer:'return=minimal'}});}else await api(`/rest/v1/online_matches?id=eq.${encodeURIComponent(s.matchId)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'waiting',updated_at:new Date().toISOString()})})}catch(e){console.warn('Online leave',e)}}home('Saliste de la sala.')}
addEventListener('pagehide',cleanupRealtime);
window.LigaOnline={show:home,leave,playerId,returnToRoom,confirmDeployment,requestMove,requestAbility,requestEndTurn,stop:()=>{session=null;cleanupRealtime();refreshing=false;}};
})();
