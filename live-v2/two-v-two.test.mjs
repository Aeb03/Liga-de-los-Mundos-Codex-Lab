import test from 'node:test';
import assert from 'node:assert/strict';
import {createUnit,initializeCombat,applyDamage,endTurn,useAbility} from './combat-core.mjs';
import {createMatch,AuthoritativeService,MemoryRepository,EFFECTIVE_SKILLS} from './server/authoritative-service.mjs';
import {SupabaseRepository} from './server/supabase-repository.mjs';
import {renderArena} from './client/presentation.mjs';
import {renderResult} from './client/feedback-ui.mjs';
const slots=[['A1','A',1,'a','onod'],['A2','A',2,'a','arfeli'],['B1','B',1,'b','coloso'],['B2','B',2,'b','piplus']].map(([id,team,slot,controllerId,championId])=>({id,team,slot,controllerId,championId}));
function core(){return initializeCombat({units:slots.map((s,i)=>createUnit({...s,position:{x:4+i,y:5}})),random:()=>.25}).state;}
test('2v2 initiatives include all four units and all tied groups use explicit randomness',()=>{
 const s=core();assert.equal(s.order.length,4);assert.equal(new Set(s.order).size,4);assert.equal(s.order[0],'B2');
 const units=slots.map((s,i)=>createUnit({...s,championId:'arfeli',position:{x:4+i,y:5}}));
 assert.throws(()=>initializeCombat({units}),(e)=>e.code==='RANDOM_REQUIRED');
 const tied=initializeCombat({units,random:()=>.75}).state;
 assert.equal(tied.tieBreak.groups.length,3);assert(tied.tieBreak.groups.every(g=>g.draws.length===1));assert.equal(new Set(tied.order).size,4);
 const unfair=structuredClone(units);unfair[3].team='A';
 assert.throws(()=>initializeCombat({units:unfair,random:()=>.25}),(e)=>e.code==='UNSUPPORTED_FORMAT');
});
test('KO of one champion preserves combat, skips its turn and only whole-team KO ends match',()=>{
 let s=core();s=applyDamage(s,{targetId:'B2',amount:200,ignoreShield:true}).state;
 assert.equal(s.phase,'active');assert.equal(s.winnerTeam,null);
 s=endTurn(s,{unitId:'B2'}).state;assert.notEqual(s.order[s.turnIndex],'B2');
 for(let i=0;i<6;i++){s=endTurn(s,{unitId:s.order[s.turnIndex]}).state;assert.notEqual(s.order[s.turnIndex],'B2');}
 assert(s.round>=3);s=applyDamage(s,{targetId:'B1',amount:200,ignoreShield:true}).state;
 assert.equal(s.phase,'ended');assert.equal(s.winnerTeam,'A');
});
test('2v2 enables friendly healing and independent PA/PM with a shared controller',()=>{
 let s=core();s.order=['A1','A2','B1','B2'];s.turnIndex=0;s.units.find(u=>u.id==='A2').hp=80;
 const before=structuredClone(s),out=useAbility(s,{unitId:'A1',abilityId:'sap',targetId:'A2'});
 assert.equal(out.state.units.find(u=>u.id==='A2').hp,88);
 assert.equal(out.state.units.find(u=>u.id==='A2').pa,before.units.find(u=>u.id==='A2').pa);
 assert.equal(out.state.units.find(u=>u.id==='A1').pa,3);
});
test('2v2 service requires four ready/deployed slots and authorizes only active champion',async()=>{
 let now=1000,version=0,id=0;const m=createMatch({mapId:"central-classic",id:'m',creatorId:'a',slots,createdAt:now}),repo=new MemoryRepository([m]),svc=new AuthoritativeService(repo,{clock:()=>now,random:()=>.25});
 const send=async(actor,type,extra={})=>{const r=await svc.command(actor,{id:`c${++id}`,matchId:'m',type,expectedVersion:version,...extra});version=r.state.version;return r.state;};
 for(const s of slots){await send(s.controllerId,'select',{slotId:s.id,championId:s.championId,skills:EFFECTIVE_SKILLS[s.championId].slice(0,4)});await send(s.controllerId,'setReady',{slotId:s.id,ready:true});}
 assert.equal((await repo.get('m')).phase,'deployment');
 for(const [i,s] of slots.entries()){await send(s.controllerId,'setPosition',{slotId:s.id,position:{x:s.team==='A'?0:11,y:i%2===0?3:4}});await send(s.controllerId,'confirmPosition',{slotId:s.id});}
 assert.equal((await svc.snapshot('a','m')).slots.B1.position,null);
 let state=await send('a','startCombat');assert.equal(state.mode,'2v2');assert.equal(state.combat.units.length,4);
 const active=state.combat.order[0],actor=state.slots[active].controllerId,other=slots.find(s=>s.controllerId===actor&&s.id!==active);
 await assert.rejects(()=>send(actor,'endTurn',{slotId:other.id,expectedTurn:state.turnSerial}),(e)=>e.code==='FORBIDDEN');
 for(let i=0;i<4;i++){const unitId=state.combat.order[state.combat.turnIndex];state=await send(state.slots[unitId].controllerId,'endTurn',{slotId:unitId,expectedTurn:state.turnSerial});}
 assert.equal(state.combat.round,2);assert.equal(new Set(state.combat.order).size,4);
 const html=renderArena({state,actor:'a',slotId:'A1',blocked:false,canMove:false,remaining:24});assert(html.includes('Slot A2'));assert(html.includes('Slot B2'));
 state=await send('a','abandon',{slotId:'A2'});assert.equal(state.result.winnerTeam,'B');assert.deepEqual(state.result.abandonedBy,['A1','A2']);assert(renderResult(state,'b').includes('<span>2v2</span>'));
});
test('room repository defaults old clients to 1v1 and routes 2v2 to isolated RPC',async()=>{
 const calls=[],repo=new SupabaseRepository({rpc:async(name,args)=>{calls.push({name,args});return {data:{},error:null};}});
 await repo.createRoom('a',{id:'m'});await repo.createRoom('a',{id:'n',mode:'2v2'});
 assert.equal(calls[0].name,'live_v2_create_room');assert.equal(calls[1].name,'live_v2_create_team_room');assert.throws(()=>repo.createRoom('a',{id:'x',mode:'3v3'}),(e)=>e.code==='UNSUPPORTED_FORMAT');
});
