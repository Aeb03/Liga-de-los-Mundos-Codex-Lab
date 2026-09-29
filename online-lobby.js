(()=>{'use strict';
const CFG=()=>window.LIGA_ONLINE_CONFIG||{};
const PROTOCOL_VERSION=Number(CFG().protocolVersion)||1;
const PLAYER_KEY='liga-online-player-id-v1';
let session=null,socket=null,heartbeat=null,syncTimer=null,refreshing=false,ref=0;
const app=()=>document.getElementById('app');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const playerId=()=>{let id=localStorage.getItem(PLAYER_KEY);if(!id){id=(crypto.randomUUID?.()||`p-${Date.now()}-${Math.random().toString(36).slice(2)}`);localStorage.setItem(PLAYER_KEY,id)}return id};
const readyConfig=()=>{const c=CFG();return /^https:\/\//.test(c.supabaseUrl||'')&&!String(c.supabaseUrl).includes('PEGAR_')&&c.publishableKey&&!String(c.publishableKey).includes('PEGAR_')};
const base=()=>String(CFG().supabaseUrl||'').replace(/\/$/,'');
const headers=(extra={})=>({'apikey':CFG().publishableKey,'Authorization':`Bearer ${CFG().publishableKey}`,'Content-Type':'application/json',...extra});
async function api(path,opt={}){const r=await fetch(base()+path,{...opt,headers:headers(opt.headers||{})});if(!r.ok){let m='';try{m=await r.text()}catch(_){}throw new Error(`${r.status} ${m||r.statusText}`)}if(r.status===204)return null;const t=await r.text();return t?JSON.parse(t):null}
function errorText(e){const raw=String(e?.message||e||'Error desconocido');try{const i=raw.indexOf('{');if(i>=0){const j=JSON.parse(raw.slice(i));const parts=[j.code,j.message,j.details,j.hint].filter(Boolean);if(parts.length)return parts.join(' · ')}}catch(_){}return raw.replace(/sb_publishable_[A-Za-z0-9_-]+/g,'sb_publishable_[oculta]')}
const code=()=>{const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';return Array.from({length:6},()=>a[Math.floor(Math.random()*a.length)]).join('')};
const roster=()=>window.LigaOnlineGame?.roster?.()||[];
const champion=id=>roster().find(c=>c.id===id)||null;
const validLoadout=(championId,list)=>{const c=champion(championId);if(!c)return[];const ids=new Set(c.abilities.map(a=>a.id));return Array.isArray(list)?list.filter(x=>ids.has(x)).slice(0,4):[]};
function shell(body){app().innerHTML=`<section class="screen online-screen"><div class="topbar"><b>🌐 1v1 ONLINE · PRUEBA 2</b><span>Protocolo ${PROTOCOL_VERSION}</span></div>${body}</section>`}
function home(msg=''){
  cleanupRealtime();session=null;
  shell(`<div class="online-card"><small>PRUEBA DE PREPARACIÓN ONLINE</small><h2>1 PLAYER vs 1 PLAYER</h2><p>Conecta dos dispositivos, sincroniza campeón + 4 habilidades y confirma que ambos llegan a la misma Arena. Las acciones de combate todavía quedan bloqueadas.</p>${msg?`<div class="online-message">${esc(msg)}</div>`:''}<div class="online-actions"><button id="onlineCreate">CREAR PARTIDA</button><div class="online-join"><input id="onlineCode" maxlength="6" autocomplete="off" placeholder="CÓDIGO"><button id="onlineJoin">UNIRSE</button></div></div><div class="online-status ${readyConfig()?'ok':'warn'}">${readyConfig()?'Supabase configurado · listo para probar':'Falta configurar Project URL + Publishable key'}</div></div><div class="actions"><button class="secondary" id="onlineBack">Volver</button></div>`);
  document.getElementById('onlineCreate').onclick=createMatch;
  document.getElementById('onlineJoin').onclick=()=>joinMatch(document.getElementById('onlineCode').value);
  document.getElementById('onlineCode').oninput=e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);
  document.getElementById('onlineBack').onclick=()=>window.LigaOnlineBack?.();
}
function ensureChoice(){
  // La selección local puede estar incompleta (0–4 habilidades) mientras el jugador edita.
  // No exigir 4 aquí: hacerlo hacía que al quitar una habilidad prep() descartara
  // session.choice y volviera al campeón/loadout guardado (normalmente Arfeli).
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
function localSlot(){return session?.slots?.find(s=>s.team===session.team)||null}
function rivalSlot(){return session?.slots?.find(s=>s.team!==session.team)||null}
function slotReady(s){return !!(s?.ready&&champion(s.champion_id)&&validLoadout(s.champion_id,s.loadout).length===4)}
function waiting(){
  shell(`<div class="online-card online-room"><small>SALA ONLINE</small><div class="room-code">${esc(session.roomCode)}</div><p>En el otro dispositivo ingresá este código.</p><div class="rival-state waiting"><b>ESPERANDO RIVAL</b><small>Sincronización activa · aguardando Equipo ${session.team==='A'?'B':'A'} / Slot 1</small></div><div class="online-slots"><span>Equipo A · Slot 1 <b>${session.team==='A'?'VOS':'VACÍO'}</b></span><span>Equipo B · Slot 1 <b>${session.team==='B'?'VOS':'VACÍO'}</b></span></div></div><div class="actions"><button class="secondary" id="onlineLeave">Abandonar sala</button></div>`);
  document.getElementById('onlineLeave').onclick=leave;
}
function schemaProblem(){
  shell(`<div class="online-card"><small>SALA ${esc(session?.roomCode||'')}</small><h2>Falta actualizar Supabase</h2><div class="online-message">Esta versión necesita las columnas champion_id y loadout en online_slots. Ejecutá el archivo supabase-online-v0635.sql una sola vez en el SQL Editor.</div></div><div class="actions"><button class="secondary" id="onlineLeave">Abandonar sala</button></div>`);
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
      <div class="online-rival-panel"><small>RIVAL CONECTADO · EQUIPO ${session.team==='A'?'B':'A'}</small><div class="online-rival-avatar">${rivalChamp?rivalChamp.icon:'?'}</div><b>${rivalChamp?esc(rivalChamp.name):(otherReady?'Selección inválida':'Preparando equipo…')}</b><span class="online-rival-ready ${otherReady?'is-ready':''}">${otherReady?'LISTO':'NO LISTO'}</span><p>${mineReady?(otherReady?'Los dos están listos. Entrando a la Arena…':'Tu selección quedó bloqueada. Esperando al rival.'):'Confirmá tu selección cuando tengas exactamente 4 habilidades.'}</p></div>
    </div>
  </div><div class="actions"><button class="secondary" id="onlineLeave">Abandonar sala</button>${mineReady?'<button id="onlineEdit">CAMBIAR SELECCIÓN</button>':`<button id="onlineReady" ${choice.loadout.length===4?'':'disabled'}>ESTOY LISTO</button>`}</div>`);
  document.getElementById('onlineLeave').onclick=leave;
  document.getElementById('onlineEdit')?.addEventListener('click',()=>setReady(false));
  document.getElementById('onlineReady')?.addEventListener('click',()=>setReady(true));
  document.querySelectorAll('[data-online-champ]').forEach(b=>b.onclick=()=>{if(mineReady)return;const next=champion(b.dataset.onlineChamp);if(!next)return;session.choice={championId:next.id,loadout:next.abilities.slice(0,4).map(a=>a.id)};prep()});
  document.querySelectorAll('[data-online-skill]').forEach(b=>b.onclick=()=>{if(mineReady)return;const id=b.dataset.onlineSkill;let list=[...choice.loadout];if(list.includes(id))list=list.filter(x=>x!==id);else if(list.length<4)list.push(id);session.choice={championId:choice.championId,loadout:list};prep()});
}
function renderRoom(){
  if(!session)return;
  if(session.schemaError)return schemaProblem();
  const rival=!!rivalSlot();session.rival=rival;
  if(!rival)return waiting();
  const a=session.slots.find(s=>s.team==='A'),b=session.slots.find(s=>s.team==='B');
  if(slotReady(a)&&slotReady(b))return launchPreview(a,b);
  prep();
}
async function createMatch(){if(!readyConfig())return home('Configurá Supabase antes de crear una sala.');let createdMatchId=null;try{home('Creando sala…');let room,rows;for(let i=0;i<5;i++){room=code();try{rows=await api('/rest/v1/online_matches',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({room_code:room,status:'waiting',team_size:1,protocol_version:PROTOCOL_VERSION})});break}catch(e){if(/^409\b/.test(String(e?.message||''))&&i<4)continue;throw e}}const match=rows?.[0];if(!match?.id)throw new Error('Supabase no devolvió el id de la partida');createdMatchId=match.id;await api('/rest/v1/online_slots',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({match_id:match.id,team:'A',slot_number:1,controller:'PLAYER',player_id:playerId(),ready:false})});session={matchId:match.id,roomCode:room,team:'A',rival:false,slots:[],choice:null,phase:'room',schemaError:false};subscribe();await refresh()}catch(e){console.error('Online create',e);if(createdMatchId){api(`/rest/v1/online_matches?id=eq.${encodeURIComponent(createdMatchId)}`,{method:'DELETE',headers:{Prefer:'return=minimal'}}).catch(()=>{})}home(`Error Supabase al crear sala: ${errorText(e)}`)}}
async function joinMatch(raw){const room=String(raw||'').trim().toUpperCase();if(!readyConfig())return home('Configurá Supabase antes de unirte.');if(room.length<4)return home('Ingresá el código de sala.');try{home('Buscando sala…');const ms=await api(`/rest/v1/online_matches?room_code=eq.${encodeURIComponent(room)}&protocol_version=eq.${PROTOCOL_VERSION}&select=id,room_code,status,team_size,protocol_version&limit=1`);const m=ms?.[0];if(!m)throw new Error('Sala inexistente o incompatible');const slots=await api(`/rest/v1/online_slots?match_id=eq.${encodeURIComponent(m.id)}&team=eq.B&slot_number=eq.1&select=id,player_id&limit=1`);if(slots?.length&&slots[0].player_id!==playerId())throw new Error('La sala ya tiene rival');if(!slots?.length)await api('/rest/v1/online_slots',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({match_id:m.id,team:'B',slot_number:1,controller:'PLAYER',player_id:playerId(),ready:false})});await api(`/rest/v1/online_matches?id=eq.${encodeURIComponent(m.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'connected',updated_at:new Date().toISOString()})});session={matchId:m.id,roomCode:m.room_code,team:'B',rival:true,slots:[],choice:null,phase:'room',schemaError:false};subscribe();await refresh()}catch(e){console.error('Online join',e);home(e.message.includes('incompatible')?'Sala inexistente o de otra versión.':`Error Supabase al unirse: ${errorText(e)}`)}}
async function setReady(value){if(!session)return;const choice=ensureChoice();if(value&&(!choice||choice.loadout.length!==4))return prep();try{const payload=value?{champion_id:choice.championId,loadout:choice.loadout,ready:true}:{ready:false};await api(`/rest/v1/online_slots?match_id=eq.${encodeURIComponent(session.matchId)}&player_id=eq.${encodeURIComponent(playerId())}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(payload)});await refresh()}catch(e){console.error('Online ready',e);session.schemaError=/champion_id|loadout|column|schema cache/i.test(e.message);if(session.schemaError)schemaProblem();else prep()}}
async function refresh(){if(!session||refreshing)return;refreshing=true;try{const slots=await api(`/rest/v1/online_slots?match_id=eq.${encodeURIComponent(session.matchId)}&controller=eq.PLAYER&select=team,slot_number,player_id,ready,champion_id,loadout`);session.slots=slots||[];session.schemaError=false;if(session.phase==='preview'){const rival=!!rivalSlot();if(!rival){session.phase='room';renderRoom()}return}renderRoom()}catch(e){console.warn('Online refresh',e);session.schemaError=/champion_id|loadout|column|schema cache/i.test(e.message);renderRoom()}finally{refreshing=false}}
async function launchPreview(a,b){if(!session||session.phase==='preview')return;session.phase='preview';if(session.team==='A'){api(`/rest/v1/online_matches?id=eq.${encodeURIComponent(session.matchId)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'prepared',updated_at:new Date().toISOString()})}).catch(()=>{})}const ok=window.LigaOnlineGame?.startPreview?.({roomCode:session.roomCode,localTeam:session.team,A:{championId:a.champion_id,loadout:a.loadout},B:{championId:b.champion_id,loadout:b.loadout}});if(!ok){session.phase='room';session.schemaError=true;renderRoom()}}
function returnToRoom(){if(!session)return home();session.phase='room';renderRoom()}
function cleanupRealtime(){if(heartbeat){clearInterval(heartbeat);heartbeat=null}if(syncTimer){clearInterval(syncTimer);syncTimer=null}if(socket){try{socket.close()}catch(_){}socket=null}}
function subscribe(){
  cleanupRealtime();if(!session)return;
  // Fallback robusto: Supabase REST cada 900 ms. Realtime acelera los cambios,
  // pero la sala no depende de que el WebSocket llegue correctamente en Android/PC.
  syncTimer=setInterval(()=>{if(session&&!document.hidden)refresh()},900);
  const topic=`realtime:ldm-${session.matchId}`;
  const ws=base().replace(/^http/,'ws')+`/realtime/v1/websocket?apikey=${encodeURIComponent(CFG().publishableKey)}&vsn=1.0.0`;
  socket=new WebSocket(ws);
  socket.onopen=()=>{
    const joinRef=String(++ref);
    socket.send(JSON.stringify({topic,event:'phx_join',payload:{config:{broadcast:{self:false},presence:{key:''},postgres_changes:[{event:'*',schema:'public',table:'online_slots',filter:`match_id=eq.${session.matchId}`},{event:'UPDATE',schema:'public',table:'online_matches',filter:`id=eq.${session.matchId}`}]},access_token:CFG().publishableKey},ref:joinRef}));
    heartbeat=setInterval(()=>{if(socket?.readyState===1)socket.send(JSON.stringify({topic:'phoenix',event:'heartbeat',payload:{},ref:String(++ref)}))},25000);
  };
  socket.onmessage=e=>{try{const m=JSON.parse(e.data);if(m.event==='postgres_changes'||m.event==='presence_state')refresh()}catch(_){}};
  socket.onclose=()=>{if(session)setTimeout(()=>{if(session)subscribe()},1500)};
  socket.onerror=e=>console.warn('Realtime',e);
}
async function leave(){const s=session;session=null;cleanupRealtime();clearInterval(window.timerId);if(s&&readyConfig()){try{await api(`/rest/v1/online_slots?match_id=eq.${encodeURIComponent(s.matchId)}&player_id=eq.${encodeURIComponent(playerId())}`,{method:'DELETE',headers:{Prefer:'return=minimal'}});const left=await api(`/rest/v1/online_slots?match_id=eq.${encodeURIComponent(s.matchId)}&controller=eq.PLAYER&select=id&limit=1`);if(!left?.length)await api(`/rest/v1/online_matches?id=eq.${encodeURIComponent(s.matchId)}`,{method:'DELETE',headers:{Prefer:'return=minimal'}});else await api(`/rest/v1/online_matches?id=eq.${encodeURIComponent(s.matchId)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'waiting',updated_at:new Date().toISOString()})})}catch(e){console.warn('Online leave',e)}}home('Saliste de la sala.')}
addEventListener('pagehide',cleanupRealtime);
window.LigaOnline={show:home,leave,playerId,returnToRoom};
})();
