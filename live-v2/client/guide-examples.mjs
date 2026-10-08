// Deterministic teaching scenes, resolved by the same core as live combat.
import {createUnit,initializeCombat,useAbility,applyDamage,endTurn,moveHouganDoll} from '../combat-core.mjs';
import {catalog} from './catalog.mjs';
export function abilityExample(championId,abilityId){
 if(!catalog[championId]?.skills.some(s=>s.id===abilityId))throw new RangeError('Unknown example');
 const unit=(id,championId,team,x,y)=>createUnit({id,championId,team,slot:1,controllerId:team==='A'?'demo':'rival',position:{x,y}});
 const actor=unit('A1',championId,'A',4,5),enemy=unit('B1',championId==='arfeli'?'coloso':'arfeli','B',6,5);
 if(['sword','daggers','quake'].includes(abilityId))enemy.x=5;
 if(abilityId==='hammer')enemy.x=7;
 if(abilityId==='collapse'){enemy.x=7;enemy.y=5;}
 if(abilityId==='magnetism'){enemy.x=7;enemy.y=4;}
 if(['trap_spikes','trap_mine'].includes(abilityId))enemy.x=7;
 if(abilityId==='hunterstep'){enemy.x=8;enemy.y=5;}
 let before=initializeCombat({units:[actor,enemy],obstacles:[],random:()=>0}).state;
 before.order=['A1','B1'];before.turnIndex=0;
 let a=before.units.find(u=>u.id==='A1'),b=before.units.find(u=>u.id==='B1');
 a.onodTurnSerial=1;a.colosoTurnSerial=1;a.pa=a.maxPa;a.pm=a.maxPm;
 let command={unitId:a.id,abilityId,targetId:b.id};
 const addObject=(type,x,y,number=1)=>{
  const maxHp=type==='pillar'?15:type==='sprout'?12:16;
  const o={id:`${type}${number}`,number,type,kind:'object',ownerId:a.id,team:'A',x,y,hp:maxHp,maxHp,alive:true,shield:[],blocksLOS:type==='pillar',...(type==='pillar'?{createdByColosoTurn:0}:type==='sprout'?{createdByOnodTurn:0}:{linkedTargetId:b.id,linkMode:'enemy',movePm:3})};before.objects.push(o);before[`next${type[0].toUpperCase()+type.slice(1)}Id`]=number+1;return o;
 };
 if(championId==='coloso'){
  const p=addObject('pillar',5,abilityId==='collapse'?5:4);
  if(['absorb','collapse','magnetism'].includes(abilityId))command.targetId=p.id;
  if(abilityId==='absorb')a.hp=85;
  if(abilityId==='collapse')command.direction={x:1,y:0};
  if(abilityId==='magnetism')command.secondaryTargetId=b.id;
  if(abilityId==='stonearmor')command.targetId=a.id;
 }
 if(championId==='piplus'&&abilityId!=='impulse'){a.markedTargetId=b.id;b.status.markedBy=a.id;}
 if(abilityId==='impulse'){command.position={x:4,y:3};delete command.targetId;}
 if(championId==='onod'){
  if(['sap','spores','awakening','reabsorption'].includes(abilityId)){
   const p=addObject('sprout',5,5);
   if(abilityId==='spores')command.targetId=p.id;
   if(abilityId==='awakening'){command.targetId=a.id;addObject('sprout',6,4,2);}
   if(abilityId==='reabsorption'){command.targetId=a.id;a.pa=2;addObject('sprout',4,4,2);}
   if(abilityId==='sap'){command.targetId=a.id;a.hp=70;p.hp=6;}
  }
  if(abilityId==='vines'){command.position={x:6,y:5};delete command.targetId;}
 }
 if(championId==='korgan'){
  if(['trap_spikes','trap_mine','grenade'].includes(abilityId)){command.position={x:6,y:5};delete command.targetId;}
  if(abilityId==='hunterstep'){command.position={x:6,y:5};delete command.targetId;}
  if(abilityId==='hook')command.distance=2;
 }
 if(championId==='houngan'&&['transfer','ritual','paintransfer','dance'].includes(abilityId)){
  a.linkedTargetId=b.id;const p=addObject('doll',5,5);
  if(abilityId==='transfer'){a.hp=70;command.targetId=p.id;}
  if(['paintransfer','dance'].includes(abilityId))command.targetId=a.id;
 }
 if(abilityId==='shield')command.targetId=a.id;
 const result=useAbility(before,command);let after=result.state,events=result.events;
 if(abilityId==='paintransfer'){const r=applyDamage(after,{targetId:a.id,amount:10,source:'example.attack'});after=r.state;events.push(...r.events);}
 if(abilityId==='dance'){
  const r=endTurn(after,{unitId:a.id});after=r.state;events.push(...r.events);
  const r2=moveHouganDoll(after,{unitId:a.id,path:[{x:5,y:5},{x:5,y:6}]});after=r2.state;events.push(...r2.events);
 }
 return {before,after,command,events};
}
export function exampleCaption(example){
 const {before,after}=example;const chunks=[];
 for(const u of after.units){const old=before.units.find(v=>v.id===u.id);const who=u.id==='A1'?u.name:'Rival';if(u.hp!==old.hp)chunks.push(`${who}: ${old.hp} → ${u.hp} PV`);if(u.x!==old.x||u.y!==old.y)chunks.push(`${who}: (${old.x}, ${old.y}) → (${u.x}, ${u.y})`);}
 const a=after.units.find(u=>u.id==='A1'),old=before.units.find(u=>u.id==='A1');chunks.push(`${a.name}: ${old.pa} → ${a.pa} PA`);
 return chunks.join(' · ');
}
