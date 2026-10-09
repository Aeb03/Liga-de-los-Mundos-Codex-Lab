import test from 'node:test';
import assert from 'node:assert/strict';
import {createUnit,initializeCombat,useAbility,endTurn,serializeState,markPiplus} from './combat-core.mjs';
import {confirmedFeedback,ConfirmedFeedbackPlayback} from './feedback-cues.mjs';
import {renderResult,renderCombatLog} from './client/feedback-ui.mjs';
const make=(a='arfeli',b='coloso')=>{
 const one=createUnit({championId:a,id:'A1',team:'A',slot:1,controllerId:'a',position:{x:5,y:5}});one.initiative=99;
 return initializeCombat({units:[one,createUnit({championId:b,id:'B1',team:'B',slot:1,controllerId:'b',position:{x:6,y:5}})]}).state;
};
test('damage/shield/KO feedback comes from confirmed events and preserves core state',()=>{
 const before=make();before.units[1].hp=5;before.units[1].shield=[{amount:3,sourceId:'B1'}];
 const command={unitId:'A1',abilityId:'sword',targetId:'B1'},out=useAbility(before,command),serialized=serializeState(out.state);
 const feedback=confirmedFeedback(out.events,before,out.state,command);
 assert(feedback.effects.some(e=>e.type==='float'&&e.text==='-5'));assert(feedback.effects.some(e=>e.type==='shieldBreak'));assert(feedback.effects.some(e=>e.type==='ko'));
 assert(feedback.logs.some(s=>s.includes('KO')));assert.equal(serializeState(out.state),serialized);
});
test('hidden traps create no public effects, names or placement coordinates; activation is public',()=>{
 const before=make('korgan'),command={unitId:'A1',abilityId:'trap_spikes',position:{x:5,y:4}};
 const out=useAbility(before,command),feedback=confirmedFeedback(out.events,before,out.state,command);
 assert.deepEqual(feedback,{effects:[],logs:[]});
 const activated=confirmedFeedback([{type:'trap.triggered',trapType:'spikes',trapId:'secret',x:5,y:4,targetId:'B1'}],before,out.state);
 assert.equal(activated.effects[0].type,'trapActivation');assert(!JSON.stringify(activated).includes('secret'));
});
test('ground AoE and collapse show complete core area even when empty; consumed pillar remains locatable',()=>{
 let before=make('onod','piplus'),command={unitId:'A1',abilityId:'vines',position:{x:5,y:3}};
 let out=useAbility(before,command),feedback=confirmedFeedback(out.events,before,out.state,command);
 assert.equal(feedback.effects.find(e=>e.type==='area').cells.length,5);
 before=make('coloso');before.objects.push({id:'pillar1',number:1,type:'pillar',kind:'object',ownerId:'A1',team:'A',x:5,y:4,hp:15,maxHp:15,alive:true,shield:[],blocksLOS:true,createdByColosoTurn:0});before.nextPillarId=2;
 command={unitId:'A1',abilityId:'collapse',targetId:'pillar1',direction:{x:0,y:-1}};
 out=useAbility(before,command);feedback=confirmedFeedback(out.events,before,out.state,command);
 assert.equal(feedback.effects.find(e=>e.type==='area').cells.length,3);assert.deepEqual(feedback.effects.find(e=>e.type==='vanish').subject,{x:5,y:4});
});
test('statuses, heal, relation, transform and poison-cancelled ability use confirmed semantic output',()=>{
 const before=make('onod');before.units[0].hp=80;
 let out=useAbility(before,{unitId:'A1',abilityId:'sap',targetId:'A1'}),f=confirmedFeedback(out.events,before,out.state);
 assert(f.effects.some(e=>e.type==='float'&&e.variant==='heal'&&e.text==='+8'));
 before.units[0].hp=1;before.units[0].status.poison=1;
 out=useAbility(before,{unitId:'A1',abilityId:'thorn',targetId:'B1'});f=confirmedFeedback(out.events,before,out.state);
 assert(!f.effects.some(e=>['activation','projectile'].includes(e.type)));assert(f.effects.some(e=>e.type==='statusActivation'));
 const g=confirmedFeedback([{type:'coloso.action',unitId:'B1',targetId:'pillar1',action:'fusion',monolith:true}],before,before);
 assert(g.logs[0].includes('Coloso'));assert(g.effects.some(e=>e.type==='transform'));
});
test('polling/replies replay VFX once, reconnect/background baseline skips old animations',()=>{
 const played=[],p=new ConfirmedFeedbackPlayback({clock:()=>1000,play:effects=>played.push(effects)});
 const s=(version,time=1000)=>({id:'m',version,presentation:{feedback:[{version,serverTime:time,effects:[{type:'ko',subject:{x:5,y:5}}]}]}});
 p.receive(s(0));p.receive(s(1));p.receive(s(1));assert.equal(played.length,1);
 p.receive(s(2),{connected:false});p.receive(s(3));assert.equal(played.length,1);
 p.suspend();p.receive(s(4));p.receive(s(5),{visible:false});p.receive(s(6,-10000));assert.equal(played.length,1);
 p.receive(s(7));assert.equal(played.length,2);
});
test('offline absorption, shield loss and mark projectile are restored from confirmed core events',()=>{
 const before=make('coloso');before.units[0].hp=80;
 before.objects.push({id:'pillar1',number:1,type:'pillar',kind:'object',ownerId:'A1',team:'A',x:5,y:4,hp:15,maxHp:15,alive:true,shield:[],blocksLOS:true,createdByColosoTurn:0});
 before.nextPillarId=2;
 const command={unitId:'A1',abilityId:'absorb',targetId:'pillar1'},out=useAbility(before,command),f=confirmedFeedback(out.events,before,out.state,command);
 assert.deepEqual(f.effects.find(e=>e.type==='transfer'),{type:'transfer',from:{x:5,y:4},to:{x:5,y:5},variant:'stone'});
 const markedBefore=make('piplus'),marked=markPiplus(markedBefore,{unitId:'A1',targetId:'B1'});
 const mark=confirmedFeedback(marked.events,markedBefore,marked.state);
 assert(mark.effects.some(e=>e.type==='projectile'&&e.variant==='tech'));
 assert(mark.effects.some(e=>e.type==='relation'&&e.kind==='mark'));
 const shield=confirmedFeedback([{type:'damage.applied',targetId:'B1',hpLost:0,absorbed:6}],before,before);
 assert(shield.effects.some(e=>e.type==='float'&&e.variant==='shield'&&e.text==='-6'));
});
test('impact coordinates follow event order around forced movement instead of the final snapshot',()=>{
 const before=make(),after=structuredClone(before);after.units[1].x=8;
 const f=confirmedFeedback([
  {type:'damage.applied',targetId:'B1',hpLost:10},
  {type:'unit.moved',unitId:'B1',forced:true,path:[{x:6,y:5},{x:7,y:5},{x:8,y:5}]},
  {type:'damage.applied',targetId:'B1',hpLost:2,source:'wound.move'}
 ],before,after);
 assert.deepEqual(f.effects.filter(e=>e.type==='float').map(e=>e.subject),[{x:6,y:5},{x:8,y:5}]);
});
test('ritual and rupture consume their visual relationship; reabsorption transfers every consumed sprout',()=>{
 for(const [champion,id,kind] of [['houngan','ritual','link'],['piplus','rupture','mark']]){
  const before=make(champion),f=confirmedFeedback([{type:'ability.used',unitId:'A1',abilityId:id,targetId:'B1'}],before,before);
  assert(f.effects.some(e=>e.type==='relation'&&e.kind===kind&&e.mode==='use'));
 }
 const before=make('onod');before.objects=[{id:'sprout1',x:5,y:4},{id:'sprout2',x:4,y:5}];
 const f=confirmedFeedback([{type:'ability.used',unitId:'A1',abilityId:'reabsorption'},...before.objects.map(o=>({type:'object.destroyed',objectId:o.id,source:'reabsorption'}))],before,before);
 assert.equal(f.effects.filter(e=>e.type==='transfer').length,2);
});
test('result is player-relative, preserves PV/KO and abandonment; no unsupported rematch',()=>{
 const state={id:'m',phase:'finished',slots:{A1:{id:'A1',team:'A',controllerId:'a',championId:'arfeli'},B1:{id:'B1',team:'B',controllerId:'b',championId:'coloso'}},combat:make(),result:{winnerTeam:'A'},presentation:{log:[{text:'<script>malicioso</script>'}]}};
 state.combat.units[1].hp=0;state.combat.units[1].alive=false;
 const a=renderResult(state,'a',{logCollapsed:false}),b=renderResult(state,'b');
 assert(a.includes('VICTORIA'));assert(b.includes('DERROTA'));assert(a.includes('100/100 PV'));assert(a.includes('KO'));assert(a.includes('Ronda 1'));assert(a.includes('Volver al Lobby'));
 assert(!a.includes('Revancha'));assert(a.includes('&lt;script&gt;'));assert(!a.includes('<script>'));
 state.result={winnerTeam:null,reason:'abandonment'};assert(renderResult(state,'a').includes('PARTIDA FINALIZADA'));assert(renderResult(state,'a').includes('abandono'));
 const entries=Array.from({length:15},(_,i)=>({text:`Entrada ${i}`}));const log=renderCombatLog({...state,presentation:{log:entries}},{collapsed:false});
 assert(!log.includes('Entrada 6<'));assert(log.includes('Entrada 7<'));assert(log.includes('Entrada 14<'));
});
