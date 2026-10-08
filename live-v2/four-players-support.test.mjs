import test from 'node:test';
import assert from 'node:assert/strict';
import {createUnit,initializeCombat,useAbility,houganAction,endTurn,endHouganDollPhase,moveHouganDoll,applyDamage,abilityTargets} from './combat-core.mjs';
import {createMatch,AuthoritativeService,MemoryRepository} from './server/authoritative-service.mjs';
import {SupabaseRepository} from './server/supabase-repository.mjs';
function fixture(){
 const units=[['A1','A','houngan','a',5,5],['A2','A','arfeli','ally',6,5],['B1','B','coloso','b',9,5],['B2','B','piplus','other',9,7]].map(([id,team,championId,controllerId,x,y])=>createUnit({id,team,championId,controllerId,slot:Number(id[1]),position:{x,y}}));
 units[0].initiative=99;units[1].hp=60;
 return initializeCombat({units,random:()=>.25}).state;
}
function nextHougan(s){
 if(s.dollPhase)s=endHouganDollPhase(s,{unitId:'A1'}).state;
 for(let i=0;i<12&&s.order[s.turnIndex]!=='A1';i++)s=endTurn(s,{unitId:s.order[s.turnIndex]}).state;
 return s;
}
function support(){let s=fixture();s=useAbility(s,{unitId:'A1',abilityId:'needle',targetId:'A2'}).state;return houganAction(s,{unitId:'A1',action:'doll',position:{x:5,y:4}}).state;}
test('Hougan support heals another controller and creates 20 PV allied doll with 50% actual-loss healing',()=>{
 let s=support();assert.equal(s.units.find(u=>u.id==='A2').hp,66);assert.equal(s.units[0].linkedTargetId,'A2');assert.equal(s.objects[0].linkMode,'ally');assert.equal(s.objects[0].hp,20);
 s.objects[0].shield=[{amount:4,sourceId:'A1'}];s=applyDamage(s,{targetId:s.objects[0].id,amount:10}).state;
 assert.equal(s.objects[0].hp,14);assert.equal(s.units.find(u=>u.id==='A2').hp,69);
 assert.equal(s.units.find(u=>u.id==='B1').hp,115);
});
test('Transfer heals Hougan and linked teammate; pain transfer protects Hougan through allied doll',()=>{
 let s=support();s=endTurn(s,{unitId:'A1'}).state;s=nextHougan(s);s.units[0].hp=70;
 s=useAbility(s,{unitId:'A1',abilityId:'transfer',targetId:s.objects[0].id}).state;
 assert.equal(s.units[0].hp,78);assert.equal(s.objects[0].hp,12);assert.equal(s.units[1].hp,70);
 assert(abilityTargets(s,'A1','paintransfer').includes('A1'));
 s=useAbility(s,{unitId:'A1',abilityId:'paintransfer',targetId:'A1'}).state;
 s=applyDamage(s,{targetId:'A1',amount:10}).state;
 assert.equal(s.units[0].hp,73);assert.equal(s.objects[0].hp,7);assert.equal(s.units[1].hp,73);
});
test('Danza allied teammate follows doll under Hougan authority without spending teammate PM',()=>{
 let s=support();s=endTurn(s,{unitId:'A1'}).state;s=nextHougan(s);
 s=useAbility(s,{unitId:'A1',abilityId:'dance',targetId:'A1'}).state;s=endTurn(s,{unitId:'A1'}).state;
 const pm=s.units[1].pm;s=moveHouganDoll(s,{unitId:'A1',path:[{x:5,y:4},{x:6,y:4}]}).state;
 assert.deepEqual({x:s.units[1].x,y:s.units[1].y},{x:7,y:5});assert.equal(s.units[1].pm,pm);
 s=endHouganDollPhase(s,{unitId:'A1'}).state;assert.equal(s.units[0].houganDance,null);
});
test('four controllers have single slots, cannot command teammate; abandon forfeits whole team',async()=>{
 const combat=fixture(),slots=combat.units.map(u=>({id:u.id,team:u.team,slot:u.slot,controllerId:u.controllerId}));
 const m=createMatch({mapId:"central-classic",id:'m',creatorId:'a',slots,createdAt:1000});assert.equal(m.players,4);
 m.phase='combat';m.combat=combat;m.turnDeadline=31000;
 for(const u of combat.units){m.slots[u.id].championId=u.championId;m.slots[u.id].skills=u.id==='A1'?['needle','transfer','paintransfer','dance']:['sword','bow','shield','daggers'];}
 const svc=new AuthoritativeService(new MemoryRepository([m]),{clock:()=>1000});
 await assert.rejects(()=>svc.command('ally',{id:'bad',matchId:'m',type:'endTurn',slotId:'A1',expectedVersion:0,expectedTurn:0}),(e)=>e.code==='FORBIDDEN');
 const out=await svc.command('ally',{id:'quit',matchId:'m',type:'abandon',slotId:'A2',expectedVersion:0});assert.equal(out.state.result.winnerTeam,'B');assert.equal(out.state.phase,'finished');
});
test('four-player RPC cannot be selected for 1v1 and legacy formats keep their routes',async()=>{
 const calls=[],repo=new SupabaseRepository({rpc:async(name,args)=>{calls.push(name);return {data:{},error:null};}});
 await repo.createRoom('a',{id:'m',mode:'2v2',players:4});assert.equal(calls[0],'live_v2_create_four_player_room');
 assert.throws(()=>repo.createRoom('a',{id:'n',mode:'1v1',players:4}),(e)=>e.code==='UNSUPPORTED_FORMAT');
});
