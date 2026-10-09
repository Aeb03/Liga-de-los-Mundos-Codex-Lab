import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,AuthoritativeService,MemoryRepository} from './authoritative-service.mjs';
function fixture(four=false){
 let now=1000;const slots=[{id:'A1',team:'A',slot:1,controllerId:'a'},...(four?[{id:'A2',team:'A',slot:2,controllerId:'a2'}]:[]),{id:'B1',team:'B',slot:1,controllerId:'b'},...(four?[{id:'B2',team:'B',slot:2,controllerId:'b2'}]:[])];
 const m=createMatch({id:'m',creatorId:'a',mapId:'central-classic',slots,createdAt:now});m.phase='deployment';m.deploymentDeadline=31000;
 Object.values(m.slots).forEach((s,i)=>Object.assign(s,{championId:i%2?'coloso':'arfeli',skills:i%2?['rock','stonearmor','quake','collapse']:['sword','daggers','bow','shield'],ready:true}));
 const repo=new MemoryRepository([m]),svc=new AuthoritativeService(repo,{clock:()=>now,random:()=>.25});return {m,repo,svc,time:n=>now=n};
}
test('deployment timeout preserves chosen cell and starts automatically via any member after 30s',async()=>{
 const x=fixture();x.m.slots.A1.position={x:2,y:6};x.repo.matches.set('m',structuredClone(x.m));
 x.time(30999);assert.equal((await x.svc.advanceAI('b','m')).phase,'deployment');assert.equal((await x.repo.get('m')).version,0);
 x.time(31000);const out=await x.svc.advanceAI('b','m');assert.equal(out.phase,'combat');assert.deepEqual(out.slots.A1.position,{x:2,y:6});assert(out.slots.B1.position);assert.equal(out.deploymentDeadline,null);assert.equal(out.turnDeadline,71000);
});
test('2v2 deadline resolves overlapping choices, reserves valid positions and races only start once',async()=>{
 const x=fixture(true);x.m.slots.A1.position={x:0,y:3};x.m.slots.A2.position={x:0,y:3};x.m.slots.A2.confirmed=true;x.m.slots.B2.position={x:10,y:3};x.repo.matches.set('m',structuredClone(x.m));x.time(31000);
 await assert.rejects(()=>x.svc.advanceAI('outsider','m'),e=>e.code==='FORBIDDEN');
 await Promise.all([x.svc.advanceAI('a','m'),x.svc.advanceAI('b','m')]);const m=await x.repo.get('m');assert.equal(m.version,1);assert.equal(m.phase,'combat');assert.deepEqual(m.slots.A2.position,{x:0,y:3});assert.deepEqual(m.slots.B2.position,{x:10,y:3});assert.equal(new Set(Object.values(m.slots).map(s=>`${s.position.x},${s.position.y}`)).size,4);assert(Object.values(m.slots).every(s=>s.confirmed));
});
test('late position changes are rejected without mutation; old deployment rooms receive 30s once',async()=>{
 const x=fixture();x.time(31000);await assert.rejects(()=>x.svc.command('a',{id:'late',matchId:'m',type:'setPosition',expectedVersion:0,slotId:'A1',position:{x:0,y:3}}),e=>e.code==='DEPLOYMENT_EXPIRED');assert.equal((await x.repo.get('m')).version,0);
 x.m.deploymentDeadline=null;x.repo.matches.set('m',structuredClone(x.m));const out=await x.svc.advanceAI('a','m');assert.equal(out.deploymentDeadline,61000);x.time(32000);assert.equal((await x.svc.advanceAI('b','m')).deploymentDeadline,61000);
});
