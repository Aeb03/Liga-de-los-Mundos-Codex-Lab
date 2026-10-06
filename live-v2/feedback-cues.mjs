import { catalog } from './client/catalog.mjs';
import { collapseCells, korganGrenadeCells, onodEffectCells } from './combat-core.mjs';
const icons={wound:'🩸',poison:'☠️',burn:'🔥',pmPenaltyNext:'🌿',vines:'🌿',paPenaltyNext:'🔨',houganPainTransfer:'🩸',houganDance:'🪆'};
const labels={wound:'Herida',poison:'Veneno',burn:'Quemadura',pmPenaltyNext:'−PM',vines:'Enredaderas',paPenaltyNext:'−PA',houganPainTransfer:'Dolor 50/50',houganDance:'Danza preparada'};
const variants={arfeli:'physical',coloso:'stone',piplus:'tech',onod:'nature',korgan:'tech',houngan:'ritual'};
const cell=e=>e&&Number.isInteger(e.x)&&Number.isInteger(e.y)?{x:e.x,y:e.y}:null;
const entities=s=>[...(s?.units??[]),...(s?.objects??[])];
const find=(s,id)=>entities(s).find(u=>u.id===id);
const name=e=>e?.name??({pillar:'Pilar',sprout:'Brote',doll:'Muñeco Vudú'})[e?.type]??'Combatiente';
export function confirmedFeedback(events,before,after,command={}){
 const effects=[],logs=[],add=(type,data)=>effects.push({type,...data});
 const subject=id=>cell(find(after,id)??find(before,id));
 const action=events.find(e=>e.type==='ability.used'),actor=find(before,action?.unitId)??find(after,action?.unitId),variant=variants[actor?.championId]??'generic';
 const cancelled=action&&events.some(e=>e.type==='damage.applied'&&e.source==='poison.ability'&&e.targetId===action.unitId&&e.killed);
 if(action&&!cancelled&&!['trap_spikes','trap_mine'].includes(action.abilityId)){
  const skill=catalog[actor?.championId]?.skills.find(s=>s.id===action.abilityId)?.name??action.abilityId;
  logs.push(`✦ ${name(actor)} usa ${skill}.`);if(cell(actor))add('activation',{subject:cell(actor),variant});
  const target=find(before,action.targetId)??find(after,action.targetId);
  if(['bow','rock','thorn','precise','vector','shot','needle','curse'].includes(action.abilityId)&&cell(target))add('projectile',{from:cell(actor),to:cell(target),variant});
  let cells=[];
  if(['vines','spores','awakening'].includes(action.abilityId)&&before)cells=onodEffectCells(before,{...action,position:action.position??command.position});
  if(action.abilityId==='grenade')cells=korganGrenadeCells(action.position??command.position);
  if(action.abilityId==='collapse'&&target&&command.direction)cells=collapseCells(target,command.direction);
  if(cells.length)add('area',{cells:cells.map(cell).filter(Boolean),variant});
  if(action.abilityId==='transfer'&&cell(target))add('transfer',{from:cell(target),to:cell(actor),variant});
 }
 for(const e of events){
  const id=e.targetId??e.unitId??e.objectId,t=find(after,id)??find(before,id),p=subject(id);
  if(e.type==='damage.applied'){
   if(e.hpLost>0){add('float',{subject:p,text:`-${e.hpLost}`,variant:'damage'});logs.push(`💥 ${name(t)} pierde ${e.hpLost} PV.`);}
   if(e.hpLost>0||e.absorbed>0)add('impact',{subject:p,variant:e.absorbed>0?'shield':variant});
   if(e.absorbed>0)logs.push(`🛡️ ${name(t)} absorbe ${e.absorbed} de daño con escudo.`);
   if(e.absorbed>0&&!t?.shield?.some(s=>s.amount>0))add('shieldBreak',{subject:p});
   const state=e.source?.startsWith('burn.')?'burn':e.source==='poison.ability'?'poison':e.source?.startsWith('wound.')?'wound':null;
   if(state)add('statusActivation',{subject:p,icon:icons[state],label:labels[state]});
   if(e.source==='doll.enemy'){const doll=after?.objects?.find(o=>o.type==='doll'&&o.linkedTargetId===e.targetId);if(doll)add('transfer',{from:cell(doll),to:p,variant:'ritual'});}
  }
  if(['unit.healed','object.healed'].includes(e.type)&&e.amount>0){add('float',{subject:p,text:`+${e.amount}`,variant:'heal'});logs.push(`💚 ${name(t)} recupera ${e.amount} PV.`);}
  if(e.type==='shield.added'&&e.amount>0){add('shield',{subject:p});add('float',{subject:p,text:`+${e.amount}`,variant:'shield'});logs.push(`🛡️ ${name(t)} obtiene ${e.amount} de escudo.`);}
  if(e.type==='status.applied'&&icons[e.status]){add('statusApplied',{subject:p,icon:icons[e.status],label:labels[e.status]});logs.push(`${icons[e.status]} ${name(t)}: ${labels[e.status]}${Number.isInteger(e.value)?' '+e.value:''}.`);}
  if(e.type==='status.expired'&&e.status==='vines')logs.push(`🌿 Enredaderas termina sobre ${name(t)}.`);
  if(e.type==='unit.moved'||e.type==='object.moved'){
   if(e.forced)add('forced',{subject:cell(e.path?.at(-1)),source:cell(e.path?.[0]),away:true});
   if(e.path?.length>1)logs.push(`➜ ${name(t)} ${e.forced?'se desplaza':'avanza'} ${e.path.length-1} casilla${e.path.length===2?'':'s'}.`);
  }
  if(e.type==='object.created'){const obj=e.object;add('spawn',{subject:cell(obj),variant:variants[find(after,obj.ownerId)?.championId]??'generic'});logs.push(`✦ Aparece ${name(obj)}.`);}
  if(e.type==='object.destroyed'){add('vanish',{subject:p,variant});logs.push(`✦ ${name(t)} desaparece.`);}
  if(e.type==='trap.triggered'){add('trapActivation',{subject:cell(e),trapType:e.trapType});logs.push(`⚠️ ${e.trapType==='spikes'?'Pinchos':'Mina eléctrica'} se activa sobre ${name(t)}.`);}
  if(e.type==='piplus.marked'){add('relation',{from:subject(e.unitId),to:subject(e.targetId),kind:'mark',mode:'apply'});logs.push(`🎯 ${name(find(after,e.unitId))} marca a ${name(t)}.`);}
  if(e.type==='link.changed'&&e.targetId){add('relation',{from:subject(e.unitId),to:subject(e.targetId),kind:'link',mode:'apply'});logs.push(`🪡 ${name(find(after,e.unitId))} vincula a ${name(t)}.`);}
  if(e.type==='hougan.paintransfer.split')add('transfer',{from:subject(e.unitId),to:subject(e.dollId),variant:'ritual'});
  if(e.type==='coloso.action'&&['fusion','exit'].includes(e.action)){add('transform',{subject:subject(e.unitId),variant:'stone'});logs.push(`🗿 ${name(find(after,e.unitId))} ${e.monolith?'entra en Monolito':'sale del Monolito'}.`);}
  if(e.type==='unit.died'){add('ko',{subject:p});logs.push(`💀 ${name(t)}: KO.`);}
  if(e.type==='turn.started')logs.push(`⏱️ Ronda ${e.round}: turno de ${name(t)}.`);
  if(e.type==='match.abandoned')logs.push('La partida terminó por abandono.');
  if(e.type==='combat.ended')logs.push(`🏆 Combate finalizado: equipo ${e.winnerTeam??'—'}.`);
 }
 // Hidden trap placement/disarm data never enters public history.
 return {effects:effects.filter(e=>e.subject||e.from||e.cells).slice(0,96),logs:logs.slice(-8)};
}
export class ConfirmedFeedbackPlayback{
 constructor({play=()=>{},clock=()=>Date.now(),maxAge=5000}={}){this.play=play;this.clock=clock;this.maxAge=maxAge;this.match=null;this.version=-1;this.resetBaseline=false;}
 suspend(){this.resetBaseline=true;}
 receive(state,{visible=true,connected=true}={}){
  if(!state)return;
  if(!connected){this.suspend();return;}
  if(this.match!==state.id||this.version<0||this.resetBaseline){this.match=state.id;this.version=state.version;this.resetBaseline=false;return;}
  if(state.version<=this.version)return;
  const from=this.version;this.version=state.version;if(!visible)return;
  for(const batch of state.presentation?.feedback??[])if(batch.version>from&&batch.version<=state.version&&this.clock()-batch.serverTime<=this.maxAge)this.play(batch.effects);
 }
}
