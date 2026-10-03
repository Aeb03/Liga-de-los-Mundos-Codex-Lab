import { catalog } from './catalog.mjs';
import { movementAvailable } from '../combat-core.mjs';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key=p=>`${p.x},${p.y}`;
export const boardPoint=(x,y)=>({x:260+(x-y)*20,y:30+(x+y)*10});
const zones={A:['0,3','1,3','0,4','2,5','1,6','2,6'],B:['11,3','10,3','11,4','9,5','10,6','9,6']};
export function renderArena({state,actor,slotId,preview,blocked,canMove,remaining,hudCollapsed=false}) {
  const own=state.slots[slotId]??Object.values(state.slots).find(s=>s.controllerId===actor);
  const active=state.combat?.units.find(u=>u.id===state.combat.order[state.combat.turnIndex]);
  const deployment=state.phase==='deployment',finished=state.phase==='finished';
  const reachable=canMove?new Set(movementAvailable(state.combat,active.id).map(key)):new Set();
  const route=new Set(preview?.path.map(key)??[]),dest=preview?.path.at(-1);
  const obstacles=new Set(state.combat?.board.obstacles??['5,4','6,4','5,7','6,7']);
  let cells='';for(let y=0;y<12;y++)for(let x=0;x<12;x++){
    const p=boardPoint(x,y),k=`${x},${y}`,zone=deployment&&zones[own?.team]?.includes(k);
    const cls=['tile',obstacles.has(k)?'obstacle':'',zone?'zone':'',reachable.has(k)?'reachable':'',route.has(k)?'route':'',dest&&key(dest)===k?'destination':''].join(' ');
    cells+=`<polygon class="${cls}" points="${p.x},${p.y-10} ${p.x+20},${p.y} ${p.x},${p.y+10} ${p.x-20},${p.y}" data-x="${x}" data-y="${y}" role="button" tabindex="0" aria-label="Casilla ${x}, ${y}"><title>${x}, ${y}</title></polygon>`;
  }
  const trail=preview?`<polyline class="trail" points="${preview.path.map(p=>{const c=boardPoint(p.x,p.y);return `${c.x},${c.y}`;}).join(' ')}"/>`:'';
  const units=state.combat?.units??Object.values(state.slots).filter(s=>s.position).map(s=>({...s,x:s.position.x,y:s.position.y,alive:true}));
  const pieces=units.filter(u=>u.alive).sort((a,b)=>(a.x+a.y)-(b.x+b.y)).map(u=>{
    const p=boardPoint(u.x,u.y);return `<ellipse class="marker" cx="${p.x}" cy="${p.y}" rx="16" ry="7" stroke="${u.controllerId===actor?'#64c6f2':'#f18b83'}"/><image class="champion-piece" href="../assets/champions/${u.championId}/${u.championId}-combat-down-right.png" x="${p.x-22}" y="${p.y-53}" width="44" height="58"/>`;
  }).join('');
  function roster(mine){
    const slots=Object.values(state.slots).filter(s=>(s.controllerId===actor)===mine);
    return `<aside class="live-roster ${mine?'own':'rival'}" aria-label="${mine?'Tu equipo':'Rivales'}"><h2>${mine?'TU EQUIPO':'RIVALES'}</h2>${slots.map(s=>{
      const u=units.find(u=>u.id===s.id),hp=u?.hp;
      return `<article class="roster-entry ${active?.id===s.id?'active':''}"><img src="../assets/champions/${s.championId}/${s.championId}-avatar.png" alt=""><div><strong>${escape(catalog[s.championId]?.name??'Campeón')}</strong><small>Slot ${escape(s.id)}</small>${hp!=null?`<span>${hp} PV · ${u.pa} PA · ${u.pm} PM</span><meter min="0" max="${u.maxHp}" value="${hp}" aria-label="Vida de ${escape(s.id)}"></meter>`:`<span>${s.confirmed?'Posición confirmada':'Desplegando'}</span>`}</div></article>`;
    }).join('')}</aside>`;
  }
  const note=deployment?(own?.position?`Posición ${own.position.x}, ${own.position.y}. Tocá otra casilla marcada para cambiarla.`:'Tocá una casilla marcada de tu zona.'):
    preview?`Recorrido: ${preview.cost} PM · Placaje: ${preview.tackleDamage} PV. Tocá de nuevo la misma casilla para mover.`:
    finished?`Ganó el equipo ${escape(state.result?.winnerTeam??'—')}.`:active?.controllerId===actor?'Tu turno: tocá una casilla para ver el recorrido.':'Esperando el turno rival.';
  const allConfirmed=Object.values(state.slots).every(s=>s.confirmed);
  const controls=deployment?`<button class="live-action" data-action="confirmPosition" ${blocked||!own?.position||own.confirmed?'disabled':''}>${own?.confirmed?'Confirmado':'Confirmar posición'}</button>${state.creatorId===actor?`<button class="live-action end-action" data-action="start" ${blocked||!allConfirmed?'disabled':''}>Iniciar combate</button>`:'<span>El creador iniciará cuando ambos confirmen.</span>'}`:
    finished?'<span>Combate finalizado</span>':`<div class="move-action" aria-label="Movimiento">MOVER<span>${active?.controllerId===actor?active.pm:'—'} PM</span></div><button class="live-action end-action" data-action="end" ${blocked||!canMove?'disabled':''}>Terminar turno</button>`;
  const pending=blocked?'Esperando confirmación o conexión…':'Estado confirmado';
  return `<section class="live-battle" aria-label="Arena Central"><div class="arena-stage"><img class="arena-platform" src="../assets/arenas/central/arena-central-base.png" alt=""><svg class="live-board" viewBox="0 0 520 280" aria-label="Tablero 12 por 12">${cells}${trail}${pieces}</svg></div>
    <div class="live-round"><span>${deployment?'DESPLIEGUE':finished?'RESULTADO':`RONDA ${state.combat.round}`}</span><strong>${active?escape(catalog[active.championId]?.name):'Arena Central'}</strong>${!deployment&&!finished?`<span class="timer" id="timer">${remaining}</span>`:''}</div>
    ${roster(true)}${roster(false)}
    <div class="live-command ${hudCollapsed?'collapsed':''}"><button class="hud-fold" data-action="toggleHud" aria-label="${hudCollapsed?'Expandir controles':'Plegar controles'}" aria-expanded="${!hudCollapsed}">${hudCollapsed?'+':'−'}</button><p class="board-note">${note}</p><div class="command-controls">${controls}<span class="phase-text" id="pending">${pending}</span></div></div></section>`;
}
