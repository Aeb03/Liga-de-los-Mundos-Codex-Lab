// Public semantic audio cues only. No coordinates, hidden traps or predicted actions.
const SPECIFIC={
  'arfeli:daggers':'arfeli.dagas_danzantes',
  'arfeli:bow':'arfeli.disparo_arco',
  'arfeli:hammer':'arfeli.golpe_martillo',
  'arfeli:sword':'arfeli.corte_espada',

  'coloso:absorb':'coloso.absorcion_rocosa',
  'coloso:pillar':'coloso.creacion_pilar',
  'coloso:quake':'coloso.golpe_sismico',
  'coloso:rock':'coloso.lanzar_roca',

  'piplus:rupture':'piplus.ruptura_marca',
  'piplus:marker':'piplus.marca',
  'piplus:precise':'piplus.flecha_precision',
  'piplus:impulse':'piplus.impulso',

  'onod:vines':'onod.enredaderas',
  'onod:germinate':'onod.germinar',
  'onod:spores':'onod.esporas_toxicas',
  'onod:thorn':'onod.espina_venenosa',
  'onod:sap':'onod.savia_vital',

  'korgan:hook':'korgan.gancho',
  'korgan:grenade':'korgan.granada',
  'korgan:shot':'korgan.disparo_caza',

  'houngan:doll':'houngan.efigie',
  'houngan:needle':'houngan.vinculo',
  'houngan:reflected':'houngan.dolor_reflejado',
  'houngan:ritual':'houngan.ritual_dolor',
  'houngan:transfer':'houngan.transferencia'
};
const unit=(combat,id)=>combat?.units?.find(u=>u.id===id);
export function confirmedAudioCues(events,combat){
 const cues=[],add=(key,delay=0)=>{if(!cues.some(c=>c.key===key))cues.push({key,delay});};
 for(const e of events){
  if(e.type==='ability.used'){
   if(['trap_spikes','trap_mine'].includes(e.abilityId))continue;
   if(events.some(d=>d.type==='damage.applied'&&d.source==='poison.ability'&&d.targetId===e.unitId&&d.killed))continue;
   const champion=unit(combat,e.unitId)?.championId,key=SPECIFIC[`${champion}:${e.abilityId}`];
   if(key)add(key);
   else if(['rock','precise','shot','thorn'].includes(e.abilityId)){add('core.proyectil');add('core.impacto',210);}
   else if(['sword','spear','vector','curse','ritual'].includes(e.abilityId))add('core.impacto',165);
   else if(['awakening','collapse'].includes(e.abilityId))add('core.area',150);
  }
  if(e.type==='piplus.marked')add('piplus.marca');
  if(e.type==='coloso.action'&&e.action==='fusion')add('coloso.fusion_pilar');
  if(e.type==='object.created')add(({pillar:'coloso.creacion_pilar',sprout:'onod.germinar',doll:'houngan.efigie'})[e.object?.type]||'core.aparicion');
  if(e.type==='trap.triggered')add(e.trapType==='spikes'?'korgan.trampa_pinchos':'korgan.trampa_electrica');
  if(['unit.healed','object.healed'].includes(e.type)&&e.amount>0&&!events.some(a=>a.type==='ability.used'&&['sap','transfer'].includes(a.abilityId)))add('core.curacion');
  if(e.type==='shield.added'&&e.amount>0)add('core.escudo');
  if(e.type==='damage.applied'){
   const target=unit(combat,e.targetId)??combat?.objects?.find(o=>o.id===e.targetId);
   if(e.absorbed>0&&target&&!target.shield?.some(s=>s.amount>0))add('core.ruptura_escudo');
   if(e.source==='doll.enemy'&&e.hpLost>0)add('houngan.dolor_reflejado');
  }
  if(e.type==='unit.died')add('core.ko',180);
 }
 return cues;
}
export class ConfirmedAudioPlayback{
 constructor({play=()=>{},clock=()=>Date.now(),maxAge=5000}={}){this.play=play;this.clock=clock;this.maxAge=maxAge;this.match=null;this.version=-1;this.resetBaseline=false;}
 suspend(){this.resetBaseline=true;}
 receive(state,{audible=true,connected=true}={}){
  if(!state)return;
  if(!connected){this.suspend();return;}
  const initial=this.match!==state.id||this.version<0||this.resetBaseline;
  if(initial){this.match=state.id;this.version=state.version;this.resetBaseline=false;return;}
  if(state.version<=this.version)return;
  const from=this.version;this.version=state.version;
  if(!audible||!connected)return;
  for(const batch of state.presentation?.audio??[]){
   if(batch.version<=from||batch.version>state.version||this.clock()-batch.serverTime>this.maxAge)continue;
   for(const cue of batch.cues)this.play(cue.key,{delay:cue.delay,dedupe:`live:${state.id}:${batch.version}:${cue.key}`});
  }
 }
}
