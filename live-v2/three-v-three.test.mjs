import test from 'node:test';
import assert from 'node:assert/strict';
import {createUnit,initializeCombat,endTurn,applyDamage} from './combat-core.mjs';
import {createMatch,AuthoritativeService,MemoryRepository,EFFECTIVE_SKILLS} from './server/authoritative-service.mjs';
import {normalizeLayout} from './server/room-layout.mjs';
import {SupabaseRepository} from './server/supabase-repository.mjs';
import {renderTeamLobby} from './client/play-screen.mjs';
const champions=['piplus','arfeli','coloso','houngan','korgan','onod'];
const slots=['A1','A2','A3','B1','B2','B3'].map((id,i)=>({id,team:id[0],slot:Number(id[1]),controllerId:id.toLowerCase(),championId:champions[i]}));
const core=()=>initializeCombat({units:slots.map((s,i)=>createUnit({...s,position:{x:2+i,y:5}})),random:()=>.25}).state;
test('3v3 interleaves teams and orders initiative only within each team',()=>{
 const s=core();assert.deepEqual(s.order,['A1','B1','A2','B2','A3','B3']);
 let next=s;for(let i=0;i<6;i++)next=endTurn(next,{unitId:next.order[next.turnIndex]}).state;assert.equal(next.round,2);
 const tied=slots.map((s,i)=>createUnit({...s,championId:'arfeli',position:{x:2+i,y:5}}));
 assert.throws(()=>initializeCombat({units:tied}),e=>e.code==='RANDOM_REQUIRED');
 const order=initializeCombat({units:tied,random:()=>.8}).state.order;assert.equal(new Set(order).size,6);for(let i=1;i<6;i++)assert.notEqual(order[i][0],order[i-1][0]);
});
test('3v3 skips KO champions and victory requires the entire rival team',()=>{
 let s=core();s=applyDamage(s,{targetId:'B1',amount:200,ignoreShield:true}).state;assert.equal(s.phase,'active');
 for(let i=0;i<8;i++){s=endTurn(s,{unitId:s.order[s.turnIndex]}).state;assert.notEqual(s.order[s.turnIndex],'B1');}
 s=applyDamage(s,{targetId:'B2',amount:200,ignoreShield:true}).state;assert.equal(s.phase,'active');
 s=applyDamage(s,{targetId:'B3',amount:200,ignoreShield:true}).state;assert.equal(s.winnerTeam,'A');
});
test('six human preparation/deployment reaches combat with hidden rival picks and 30 second turns',async()=>{
 let now=1000;const repo=new MemoryRepository(),m=createMatch({id:'six',creatorId:'a1',slots,createdAt:now,mapId:'central-classic'});m.preparationFlow=true;repo.matches.set(m.id,m);
 const service=new AuthoritativeService(repo,{clock:()=>now,random:()=>.25});
 const cmd=async(slot,type,args={})=>{const state=await repo.get('six');return service.command(slot.controllerId,{id:crypto.randomUUID(),matchId:'six',expectedVersion:state.version,type,...args});};
 for(const slot of slots){await cmd(slot,'select',{slotId:slot.id,championId:slot.championId,skills:EFFECTIVE_SKILLS[slot.championId].slice(0,4)});}
 const preparing=await service.snapshot('a1','six');assert.equal(preparing.slots.A3.championId,'coloso');assert.equal(preparing.slots.B1.championId,null);
 for(const slot of slots)await cmd(slot,'setReady',{slotId:slot.id,ready:true});
 assert.equal((await service.snapshot('a1','six')).slots.B1.championId,'houngan');now+=5001;await service.advanceAI('a1','six');
 let current=await repo.get('six');assert.equal(current.phase,'deployment');assert.equal(current.mode,'3v3');
 for(const slot of slots){const cell=current.arena.deployment[slot.team][slot.slot-1].split(',').map(Number);await cmd(slot,'setPosition',{slotId:slot.id,position:{x:cell[0],y:cell[1]}});await cmd(slot,'confirmPosition',{slotId:slot.id});}
 await cmd(slots[0],'startCombat');current=await repo.get('six');assert.equal(current.combat.units.length,6);assert.equal(current.turnDeadline-now,30000);
 const html=renderTeamLobby({...m,countdownDeadline:now+5000},'a1');assert.match(html,/lineup-center/);assert.match(html,/lineup-left/);assert.match(html,/lineup-right/);
});
test('3v3 layouts support shared humans and reject duplicate AI champions in any seat',async()=>{
 const layout=Object.fromEntries(slots.map(s=>[s.id,{controller:s.id}]));assert.equal(Object.keys(normalizeLayout(layout)).length,6);
 const shared={...layout,A3:{controller:'A1'},B2:{controller:'ai',championId:'coloso'},B3:{controller:'ai',championId:'coloso'}};assert.throws(()=>normalizeLayout(shared),e=>e.code==='DUPLICATE_CHAMPION');
 let called;const repo=new SupabaseRepository({rpc:async(name,args)=>{called={name,args};return {data:{}};}});await repo.createRoom('actor',{id:'six',mode:'3v3',players:6});assert.equal(called.name,'live_v2_create_flexible_room');assert.equal(Object.keys(called.args.p_layout).length,6);
});
