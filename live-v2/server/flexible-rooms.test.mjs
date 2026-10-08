import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLayout, BOT_SKILLS } from './room-layout.mjs';
import { planAI } from './ai.mjs';
import { createMatch, AuthoritativeService, MemoryRepository } from './authoritative-service.mjs';
import { createUnit, initializeCombat, endTurn } from '../combat-core.mjs';
const layout={A1:{controller:'A1'},A2:{controller:'A1'},B1:{controller:'B1'},B2:{controller:'B1'}};
test('shared controllers stay within their team and AI groups must not impersonate humans',()=>{
  assert.equal(normalizeLayout(layout).A2.controller,'A1');
  assert.throws(()=>normalizeLayout({...layout,A2:{controller:'B1'}}),e=>e.code==='INVALID_LAYOUT');
  assert.throws(()=>normalizeLayout({...layout,B1:{controller:'ai',championId:'arfeli'}}),e=>e.code==='INVALID_LAYOUT');
  assert.throws(()=>normalizeLayout({...layout,B1:{controller:'ai',championId:'arfeli'},B2:{controller:'ai',championId:'arfeli'}}),e=>e.code==='DUPLICATE_CHAMPION');
  const mixed=normalizeLayout({...layout,A2:{controller:'ai',championId:'onod'},B2:{controller:'B2'}});
  assert.deepEqual(mixed.A2.skills,BOT_SKILLS.onod);
});
function botMatch(champion='arfeli'){
  const slots=[{id:'A1',team:'A',slot:1,controllerId:'human'},{id:'B1',team:'B',slot:1,controllerId:'ai:B1',controllerKind:'ai'}];
  const m=createMatch({mapId:"central-classic",id:'m',creatorId:'human',slots,createdAt:1000});
  m.phase='combat';m.turnDeadline=41000;
  m.combat=initializeCombat({units:slots.map((s,i)=>createUnit({...s,championId:i?champion:'coloso',position:{x:i?6:5,y:5}})),random:()=>0.5,clock:1000}).state;
  while(m.combat.order[m.combat.turnIndex]!=='B1')m.combat=endTurn(m.combat,{unitId:m.combat.order[m.combat.turnIndex]}).state;
  m.slots.B1.skills=BOT_SKILLS[champion];return m;
}
test('every bot champion produces legal actions and eventually finishes its own turn',()=>{
 for(const champion of Object.keys(BOT_SKILLS)){
  const m=botMatch(champion);let ended=false;
  for(let i=0;i<18;i++){
    const planned=planAI(m.combat,m.slots.B1);m.combat=planned.out.state;
    if(m.combat.phase==='ended'||m.combat.order[m.combat.turnIndex]!=='B1'){ended=true;break;}
  }
  assert(ended,champion+' should not loop indefinitely');
 }
});
test('AI cannot be manually controlled, outsiders cannot advance it, concurrent polls commit once',async()=>{
 const repo=new MemoryRepository([botMatch()]),svc=new AuthoritativeService(repo,{clock:()=>1000});
 await assert.rejects(()=>svc.advanceAI('outsider','m'),e=>e.code==='FORBIDDEN');
 await assert.rejects(()=>svc.command('human',{id:'manual',matchId:'m',type:'endTurn',slotId:'B1',expectedVersion:0,expectedTurn:0}),e=>e.code==='FORBIDDEN');
 await Promise.all([svc.advanceAI('human','m'),svc.advanceAI('human','m')]);
 assert.equal((await repo.get('m')).version,1);
 const out=await svc.snapshot('human','m');assert(out.combat.units.find(u=>u.id==='A1').hp<115);
});
test('human turns are never advanced by AI polling',async()=>{
 const m=botMatch();m.combat=endTurn(m.combat,{unitId:'B1'}).state;
 const svc=new AuthoritativeService(new MemoryRepository([m]),{clock:()=>1000});
 assert.equal((await svc.advanceAI('human','m')).version,0);
});
