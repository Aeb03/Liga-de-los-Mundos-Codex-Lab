import test from 'node:test';
import assert from 'node:assert/strict';
import {createUnit,initializeCombat,applyDamage,resolvePath,endTurn} from './combat-core.mjs';
import {createMatch,AuthoritativeService,MemoryRepository,EFFECTIVE_SKILLS} from './server/authoritative-service.mjs';
import {renderArena} from './client/presentation.mjs';
const slots=[['A1','A','a','arfeli'],['A2','A','ally','piplus'],['B1','B','b','coloso'],['B2','B','other','onod']].map(([id,team,controllerId,championId])=>({id,team,slot:Number(id[1]),controllerId,championId}));
const setup=()=>initializeCombat({units:slots.map((s,i)=>createUnit({...s,position:{x:2+i,y:3}})),random:()=>.25}).state;
test('2v2 alternates teams and sorts teammates by initiative',()=>{
 const s=setup();assert.deepEqual(s.order,['A2','B2','A1','B1']);
 assert.deepEqual(s.order.map(id=>s.units.find(u=>u.id===id).team),['A','B','A','B']);
});
test('a dead champion no longer occupies its cell or blocks subsequent turns',()=>{
 let s=setup();s=applyDamage(s,{targetId:'B1',amount:200,ignoreShield:true}).state;
 s.order=['A2','B2','A1','B1'];s.turnIndex=0;
 s=resolvePath(s,'A2',[{x:3,y:3},{x:4,y:3}]).state;
 assert.equal(s.units.find(u=>u.id==='A2').x,4);
 assert.doesNotThrow(()=>endTurn(s,{unitId:'A2'}));
});
test('same-team duplicate selection is rejected even through the authority',async()=>{
 const m=createMatch({mapId:"central-classic",id:'m',creatorId:'a',slots,createdAt:0}),repo=new MemoryRepository([m]),svc=new AuthoritativeService(repo);
 const select=(id,v,slotId)=>({id,matchId:'m',type:'select',expectedVersion:v,slotId,championId:'arfeli',skills:EFFECTIVE_SKILLS.arfeli.slice(0,4)});
 await svc.command('a',select('one',0,'A1'));
 await assert.rejects(()=>svc.command('ally',select('two',1,'A2')),e=>e.code==='DUPLICATE_CHAMPION');
 await svc.command('b',select('opponent',1,'B1'));
});
test('an allied champion controlled by a second phone has a blue marker',()=>{
 const combat=setup(),state={id:'m',phase:'combat',slots:Object.fromEntries(slots.map(s=>[s.id,{...s,skills:EFFECTIVE_SKILLS[s.championId].slice(0,4)}])),combat};
 const html=renderArena({state,actor:'a',slotId:'A1',canMove:true,remaining:40});
 const ally=html.match(/<g[^>]*data-inspect-id="A2".*?<\/g>/s)?.[0];assert(ally);assert.match(ally,/stroke="#64c6f2"/);
});
