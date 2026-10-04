import { abilityOverlay } from './ability-overlay.mjs?v=20261004-champions1';
import { spriteSource } from './motion.mjs?v=20261004-champions1';
import { catalog } from './catalog.mjs?v=20261003-layout1';
import { movementAvailable, abilityDefinitions, pillarAvailable, colosoActionTargets } from '../combat-core.mjs?v=20261004-champions1';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key=p=>`${p.x},${p.y}`;
export const boardPoint=(x,y)=>({x:260+(x-y)*20,y:30+(x+y)*10});
const zones={A:['0,3','1,3','0,4','2,5','1,6','2,6'],B:['11,3','10,3','11,4','9,5','10,6','9,6']};
export function unitIndicators(unit) {
  return [
    ['Escudo', (unit.shield ?? []).reduce((total, shield) => total + shield.amount, 0)],
    ['Herida', unit.status?.wound ?? 0],
    ['Veneno', unit.status?.poison ?? 0],
    ['Quemadura', unit.status?.burn ?? 0],
    ['Monolito',unit.monolith?1:0],
  ].filter(([, value]) => value > 0);
}
function statuses(unit) {
  return unitIndicators(unit).map(([label,value])=>`${label} ${value}`).join(' · ');
}
export function turnSequence(combat) {
  if (!combat) return [];
  const ordered = [...combat.order.slice(combat.turnIndex), ...combat.order.slice(0,combat.turnIndex)];
  return ordered.map(id=>combat.units.find(u=>u.id===id)).filter(u=>u?.alive);
}
export function renderArena({state,actor,slotId,preview,blocked,canMove,remaining,hudCollapsed=false,abilitySelection=null}) {
  const own=state.slots[slotId]??Object.values(state.slots).find(s=>s.controllerId===actor);
  const active=state.combat?.units.find(u=>u.id===state.combat.order[state.combat.turnIndex]);
  const deployment=state.phase==='deployment',finished=state.phase==='finished';
  const overlay=abilitySelection?.abilityId==='createPillar'&&canMove&&!blocked?{range:pillarAvailable(state.combat,active.id),targets:[],effect:abilitySelection.position?[abilitySelection.position]:[]}:abilitySelection&&canMove&&!blocked&&state.phase==='combat'?(['fusion','recycle'].includes(abilitySelection.abilityId)?{range:[],targets:colosoActionTargets(state.combat,active.id,abilitySelection.abilityId),effect:abilitySelection.targetId?[state.combat.objects.find(p=>p.id===abilitySelection.targetId)]:[]}:abilityOverlay(state.combat,active.id,abilitySelection.abilityId??'sword',abilitySelection.targetId,abilitySelection)):{range:[],targets:[],effect:[]};
  const rangeCells=new Map(overlay.range.map(cell=>[key(cell),cell]));
  const effectCells=new Set(overlay.effect.map(key));
  const forcedCells=new Set((overlay.forced?.moves??[]).map(move=>key(move.path.at(-1))));
  const validTargets=new Set(overlay.targets);
  const targetCells=new Set([...(state.combat?.units??[]),...(state.combat?.objects??[])].filter(u=>validTargets.has(u.id)).map(key));
  const reachable=canMove&&!abilitySelection?new Set(movementAvailable(state.combat,active.id).map(key)):new Set();
  const route=new Set(preview?.path.map(key)??[]),dest=preview?.path.at(-1);
  const obstacles=new Set(state.combat?.board.obstacles??['5,4','6,4','5,7','6,7']);
  let cells='';for(let y=0;y<12;y++)for(let x=0;x<12;x++){
    const p=boardPoint(x,y),k=`${x},${y}`,zone=deployment&&zones[own?.team]?.includes(k);
    const cls=['tile',rangeCells.has(k)?'ability-range':'',rangeCells.get(k)?.blocked?'ability-blocked':'',targetCells.has(k)?'ability-target':'',effectCells.has(k)?'ability-selected ability-effect':'',forcedCells.has(k)?'forced-destination':'',obstacles.has(k)?'obstacle':'',zone?'zone':'',reachable.has(k)?'reachable':'',route.has(k)?'route':'',dest&&key(dest)===k?'destination':''].join(' ');
    cells+=`<polygon class="${cls}" points="${p.x},${p.y-10} ${p.x+20},${p.y} ${p.x},${p.y+10} ${p.x-20},${p.y}" data-x="${x}" data-y="${y}" role="button" tabindex="0" aria-label="Casilla ${x}, ${y}"><title>${x}, ${y}${rangeCells.has(k)?rangeCells.get(k).blocked?" · Alcance: línea de visión bloqueada":" · Alcance de habilidad":""}${targetCells.has(k)?" · Objetivo válido":""}${effectCells.has(k)?" · Casilla afectada":""}${forcedCells.has(k)?" · Destino del desplazamiento":""}</title></polygon>`;
  }
  const trail=preview?`<polyline class="trail" points="${preview.path.map(p=>{const c=boardPoint(p.x,p.y);return `${c.x},${c.y}`;}).join(' ')}"/>`:'';
  const forcedTrail=(overlay.forced?.moves??[]).map(move=>`<polyline class="forced-trail" points="${move.path.map(p=>{const c=boardPoint(p.x,p.y);return `${c.x},${c.y}`;}).join(' ')}" marker-end="url(#forced-arrow)"/>`).join('');
  const units=state.combat?.units??Object.values(state.slots).filter(s=>s.position).map(s=>({...s,x:s.position.x,y:s.position.y,alive:true}));
  const pieces=units.filter(u=>u.alive).sort((a,b)=>(a.x+a.y)-(b.x+b.y)).map(u=>{
    const p=boardPoint(u.x,u.y);
    const indicators=statuses(u), life=u.hp == null ? '' : `<g class="piece-health" aria-label="${escape(catalog[u.championId]?.name)}: ${u.hp}/${u.maxHp} PV${indicators?`, ${escape(indicators)}`:''}"><rect x="${p.x-30}" y="${p.y-68}" width="60" height="12" rx="2"/><rect class="health-fill" x="${p.x-29}" y="${p.y-67}" width="${58*Math.max(0,Math.min(1,u.hp/u.maxHp))}" height="10" rx="1"/><text x="${p.x}" y="${p.y-59}">${u.hp}/${u.maxHp}</text>${indicators?`<text class="piece-status" x="${p.x}" y="${p.y-72}">${escape(indicators)}</text>`:''}</g>`;
    return `<g data-motion-unit="${escape(u.id)}" data-x="${u.x}" data-y="${u.y}" data-champion="${u.championId}" data-monolith="${Boolean(u.monolith)}" data-facing="${state.presentation?.facings?.[u.id]??(u.team==='B'?'up-left':'down-right')}"><ellipse class="marker" cx="${p.x}" cy="${p.y}" rx="16" ry="7" stroke="${u.controllerId===actor?'#64c6f2':'#f18b83'}"/><image class="champion-piece" href="${spriteSource(u.championId,state.presentation?.facings?.[u.id]??(u.team==='B'?'up-left':'down-right'),u.monolith)}" x="${p.x-22}" y="${p.y-53}" width="44" height="58"/>${life}</g>`;
  }).join('');
  const obstaclePieces=[...obstacles].map(tile=>{const [x,y]=tile.split(',').map(Number),p=boardPoint(x,y);return {x,y,html:`<g class="arena-obstacle" aria-label="Obstáculo de arena en ${x}, ${y}"><image href="assets/arena-block.png?v=20261004-champions1" x="${p.x-23}" y="${p.y-28}" width="46" height="38"/></g>`};}).sort((a,b)=>a.x+a.y-b.x-b.y).map(o=>o.html).join('');
  const objectPieces=(state.combat?.objects??[]).filter(o=>o.alive).map(o=>{const p=boardPoint(o.x,o.y);return `<g class="pillar-piece" aria-label="Pilar ${o.number}: ${o.hp}/15 PV"><image href="../assets/tactical/objects/pilar-coloso.png" x="${p.x-20}" y="${p.y-45}" width="40" height="50"/><text x="${p.x}" y="${p.y-48}" text-anchor="middle">${o.hp}/15${o.shield.length?' · Escudo '+o.shield.reduce((n,s)=>n+s.amount,0):''}</text></g>`;}).join('');
  function roster(mine){
    const slots=Object.values(state.slots).filter(s=>(s.team===own?.team)===mine);
    return `<aside class="live-roster ${mine?'own':'rival'}" aria-label="${mine?'Tu equipo':'Rivales'}"><h2>${mine?'TU EQUIPO':'RIVALES'}</h2>${slots.map(s=>{
      const u=units.find(u=>u.id===s.id),hp=u?.hp;
      return `<article class="roster-entry ${active?.id===s.id?'active':''}"><img src="../assets/champions/${s.championId}/${s.championId}-avatar.png" alt=""><div><strong>${escape(catalog[s.championId]?.name??'Campeón')}</strong><small>Slot ${escape(s.id)}</small>${hp!=null?`<span>${hp} PV · ${u.pa} PA · ${u.pm} PM</span><meter min="0" max="${u.maxHp}" value="${hp}" aria-label="Vida de ${escape(s.id)}"></meter>`:`<span>${s.confirmed?'Posición confirmada':'Desplegando'}</span>`}</div></article>`;
    }).join('')}</aside>`;
  }
  const selectedTarget=[...(state.combat?.units??[]),...(state.combat?.objects??[])].find(u=>u.id===abilitySelection?.targetId);
  const selectedAbilityId=abilitySelection?.abilityId??'sword',selectedDefinition=abilityDefinitions()[selectedAbilityId];
  const masteryBonus=active?.championId==='arfeli'&&!active.arfeliMasteryChain?.includes(selectedAbilityId)?(active.arfeliMasteryChain?.length??0):0;
  const selectedName=({fusion:'Fusión de Pilar',recycle:'Reciclaje Rocoso'})[selectedAbilityId]??catalog[active?.championId]?.skills.find(s=>s.id===selectedAbilityId)?.name;
  const effect=['fusion','recycle','absorb','collapse','magnetism'].includes(selectedAbilityId)?'':selectedAbilityId==='stonearmor'?'10 escudo':selectedAbilityId==='shield'?`${15+masteryBonus} escudo`:`${selectedDefinition?.damage+masteryBonus} daño${selectedDefinition?.wound?` + Herida ${selectedDefinition.wound}`:""}`;
  const legend=overlay.range.length?'<span class="range-legend" aria-label="Referencias de alcance"><span class="range-key">Alcance</span><span class="blocked-key">LOS bloqueada</span><span class="target-key">Objetivo</span><span class="effect-key">Efecto</span></span> ':'';
  const forcedNote=overlay.forced?`${overlay.forced.moves.length?' · '+(selectedAbilityId==='hammer'?'Salto a casilla libre':(selectedAbilityId==='spear'?'Atracción':'Empuje')+' 1 casilla'):overlay.forced.blocked.length?' · Desplazamiento bloqueado':''}${overlay.forced.damage.filter(e=>e.source.startsWith('collision.')).map(e=>` · Colisión ${e.targetId}: ${e.amount} daño`).join('')}${overlay.forced.damage.filter(e=>['wound.forced','wound.jump'].includes(e.source)).map(e=>` · Herida: ${e.amount} daño`).join('')}${overlay.forced.deaths.length?' · Muerte: '+overlay.forced.deaths.join(', '):''}`:'';
  const stagedNote=abilitySelection?.targetId&&['collapse','magnetism'].includes(selectedAbilityId)?(selectedAbilityId==='collapse'?(abilitySelection.direction?'Colapso: área marcada. Tocá nuevamente la dirección elegida para confirmar.':'Colapso: tocá una casilla cardinal junto al Pilar para elegir dirección.'):(abilitySelection.secondaryTargetId?'Magnetismo: recorrido marcado. Tocá nuevamente el combatiente para confirmar.':'Magnetismo: elegí un combatiente marcado.')):null;
  const note=stagedNote??(selectedAbilityId==='createPillar'&&abilitySelection?(abilitySelection.position?'Crear Pilar: 15 PV · 0 PA. Tocá de nuevo la misma casilla para confirmar.':'Crear Pilar: elegí una casilla libre marcada.'):abilitySelection?(selectedTarget?`${selectedName}: ${effect}${forcedNote} · ${selectedDefinition?.cost??(selectedAbilityId==='fusion'?3:0)} PA. Tocá de nuevo la misma casilla para confirmar.`:`${selectedName}: elegí un objetivo marcado. Tocá MOVER para cancelar.`):
    deployment?(own?.position?`Posición ${own.position.x}, ${own.position.y}. Tocá otra casilla marcada para cambiarla.`:'Tocá una casilla marcada de tu zona.'):
    preview?`Recorrido: ${preview.cost} PM · Placaje: ${preview.tackleDamage} PV${preview.woundDamage?` · Herida: ${preview.woundDamage} daño · PV final: ${preview.remainingHp}${preview.diesDuringPath?" · MUERTE DURANTE EL RECORRIDO":""}`:""}. Tocá de nuevo la misma casilla para mover.`:
    finished?`Ganó el equipo ${escape(state.result?.winnerTeam??'—')}.`:active?.controllerId===actor?'Tu turno: tocá una casilla para ver el recorrido.':'Esperando el turno rival.');
  const allConfirmed=Object.values(state.slots).every(s=>s.confirmed);
  const controls=deployment?`<button class="live-action" data-action="confirmPosition" ${blocked||!own?.position||own.confirmed?'disabled':''}>${own?.confirmed?'Confirmado':'Confirmar posición'}</button>${state.creatorId===actor?`<button class="live-action end-action" data-action="start" ${blocked||!allConfirmed?'disabled':''}>Iniciar combate</button>`:'<span>El creador iniciará cuando ambos confirmen.</span>'}`:
    finished?'<span>Combate finalizado</span>':`<div class="move-action" data-action="moveMode" role="button" tabindex="0" aria-label="Movimiento">MOVER<span>${active?.controllerId===actor?active.pm:'—'} PM</span></div><button class="live-action end-action" data-action="end" ${blocked||!canMove?'disabled':''}>Terminar turno</button>`;
  const turnOrder=state.combat?`<ol class="turn-order" aria-label="Orden de turnos">${turnSequence(state.combat).map((u,i)=>`<li class="${i===0?'current':''}" ${i===0?'aria-current="step"':''} title="${escape(catalog[u.championId]?.name)} · ${escape(u.id)}"><img src="../assets/champions/${u.championId}/${u.championId}-avatar.png" alt="${escape(catalog[u.championId]?.name)}"><span>${i+1} · ${escape(catalog[u.championId]?.name)}<small>${escape(u.id)}</small></span></li>`).join('')}</ol>`:'';
  const championCard=active?`<div class="active-champion" aria-label="Campeón activo"><img src="../assets/champions/${active.championId}/${active.championId}-avatar.png" alt=""><div class="active-details"><strong>${escape(catalog[active.championId]?.name)} · ${escape(active.id)}</strong><div class="active-life"><meter min="0" max="${active.maxHp}" value="${active.hp}" aria-label="Vida del campeón activo"></meter><span>${active.hp}/${active.maxHp} PV</span></div><div class="active-resources"><span>${active.pa} PA</span><span>${active.pm} PM</span><span>Escudo ${(active.shield??[]).reduce((n,s)=>n+s.amount,0)}</span></div>${unitIndicators(active).filter(([label])=>label!=='Escudo').length?`<small>${escape(unitIndicators(active).filter(([label])=>label!=='Escudo').map(([label,value])=>`${label} ${value}`).join(' · '))}</small>`:''}</div></div>`:'';
  const skillButtons=active?`<div class="combat-skills" aria-label="Habilidades seleccionadas">${(state.slots[active.id]?.skills??[]).map(id=>{const skill=catalog[active.championId]?.skills.find(s=>s.id===id);const def=abilityDefinitions()[id],enabled=state.phase==='combat'&&def?.championId===active.championId;const uses=active.skillUsesThisTurn?.[id]??0;const chosen=abilitySelection&&(abilitySelection.abilityId??'sword')===id;return `<button class="combat-skill ${enabled&&chosen?'selected-skill':''}" ${enabled?`data-action="${id}"`:''} ${!enabled||blocked||!canMove||active.pa<(def?.cost??0)||(def?.maxUses&&uses>=def.maxUses)?'disabled':''} title="${enabled?`${def.cost} PA · Alcance ${def.range}`:'Todavía no disponible'}" aria-label="${escape(skill?.name??id)}${enabled?'':': todavía no disponible'}" ${enabled?`aria-pressed="${Boolean(chosen)}"`:''}><span class="skill-meta">${enabled&&def.maxUses?`${uses}/${def.maxUses}`:!enabled&&skill?.maxUsesPerTurn?`Máx. ${skill.maxUsesPerTurn}`:""}<b>${skill?.cost??"—"} PA</b></span><span class="skill-symbol" aria-hidden="true">${escape(skill?.icon??"✦")}</span><span class="skill-name">${escape(skill?.name??id)}</span></button>`;}).join('')}</div>`:'';
  const pending=blocked?'Esperando confirmación o conexión…':'Estado confirmado';
  return `<section class="live-battle" aria-label="Arena Central"><div class="arena-stage"><img class="arena-platform" src="../assets/arenas/central/arena-central-base.png" alt=""><svg class="live-board" viewBox="0 0 520 280" aria-label="Tablero 12 por 12"><defs><marker id="forced-arrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5" fill="#d6adff"/></marker></defs>${cells}${trail}${forcedTrail}${obstaclePieces}${objectPieces}${pieces}</svg></div>
    <div class="live-round"><div class="round-summary"><span>${deployment?'DESPLIEGUE':finished?'RESULTADO':`RONDA ${state.combat.round}`}</span><strong>${active?escape(catalog[active.championId]?.name):'Arena Central'}</strong>${!deployment&&!finished?`<span class="timer" id="timer">${remaining}</span>`:''}</div>${turnOrder}</div>
    ${roster(true)}${roster(false)}
    <div class="live-command ${hudCollapsed?'collapsed':''}"><button class="hud-fold" data-action="toggleHud" aria-label="${hudCollapsed?'Expandir controles':'Plegar controles'}" aria-expanded="${!hudCollapsed}">${hudCollapsed?'+':'−'}</button><div class="command-main">${championCard}${skillButtons}<div class="command-controls">${active?.championId==='coloso'&&state.phase==='combat'?`<button class="live-action pillar-action" data-action="createPillar" ${blocked||!canMove||!pillarAvailable(state.combat,active.id).length?'disabled':''}>Crear Pilar · 0 PA</button>`:''}${active?.championId==='coloso'&&state.phase==='combat'?`<details class="coloso-options"><summary>Dominio Rocoso${active.monolith?' · Monolito':''}</summary>${[active.monolith?'exit':'fusion',...(active.monolith?['recycle']:[])].map(action=>`<button class="live-action" data-action="${action}" ${blocked||!canMove||!colosoActionTargets(state.combat,active.id,action).length?'disabled':''}>${({fusion:'Fusión · 3 PA',exit:'Salir · 0 PA',recycle:'Reciclaje · 0 PA'})[action]}</button>`).join('')}</details>`:''}${controls}</div></div><div class="command-feedback"><p class="board-note">${legend}${note}</p><span class="phase-text" id="pending">${pending}</span></div></div></section>`;
}
