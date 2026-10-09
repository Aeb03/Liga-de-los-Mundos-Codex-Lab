import test from 'node:test';import assert from 'node:assert/strict';
import {createDemoAPI,tutorialHint} from './demo.mjs';import {accountAllowed} from './entry.mjs';
import {calculatePath,previewPath} from '../combat-core.mjs';
import {commandFingerprint as browserHash} from './demo/protocol.mjs';import {commandFingerprint as serverHash} from '../server/protocol.mjs';
test('entry only admits a confirmed account to the circuit',()=>{assert.equal(accountAllowed(null),false);assert.equal(accountAllowed({is_anonymous:true,email_confirmed_at:'now'}),false);assert.equal(accountAllowed({is_anonymous:false}),false);assert.equal(accountAllowed({id:'a',is_anonymous:false,email_confirmed_at:'now'}),true);});
test('browser fingerprint matches server SHA-256',async()=>{const value={id:'example',nested:{z:1,a:2},items:[4,2]};assert.equal(await browserHash(value),serverHash(value));});
test('normal demo prepares, deploys, plays and expires turns entirely in memory',async()=>{
 let now=1000;const api=createDemoAPI({clock:()=>now,random:()=>0.2});let state=(await api('create',{room:{id:crypto.randomUUID(),layout:{B1:{championId:'coloso'}}}})).data;
 const command=async(type,extra={})=>{const r=await api('command',{command:{id:crypto.randomUUID(),matchId:state.id,type,expectedVersion:state.version,...extra}});state=r.data.state;return r;};
 await command('select',{slotId:'A1',championId:'arfeli',skills:['sword','bow','shield','hammer']});await command('setReady',{slotId:'A1',ready:true});now+=5000;state=(await api('snapshot',{matchId:state.id})).data;assert.equal(state.phase,'deployment');
 const [x,y]=state.arena.deployment.A[0].split(',').map(Number);await command('setPosition',{slotId:'A1',position:{x,y}});await command('confirmPosition',{slotId:'A1'});await command('startCombat');assert.equal(state.phase,'combat');
 const serial=state.turnSerial;now+=40001;state=(await api('snapshot',{matchId:state.id})).data;assert(state.turnSerial>serial);
 await assert.rejects(api('join',{matchId:state.id}),/DEMO_ONLY/);
 const fresh=createDemoAPI();await assert.rejects(fresh('snapshot',{matchId:state.id}),/Partida inexistente/);
});
test('guided tutorial uses actual movement, damage and AI, and commands are idempotent',async()=>{
 const api=createDemoAPI({clock:()=>1000,random:()=>0.2});let state=(await api('create',{room:{id:crypto.randomUUID(),tutorial:true}})).data;assert.equal(state.phase,'combat');assert.equal(state.arena.pieces.length,0);assert.match(tutorialHint(state.combat),/Mover/);
 const path=calculatePath(state.combat,'A1',{x:5,y:5});assert.equal(previewPath(state.combat,'A1',path).lethal,false);
 let cmd={id:crypto.randomUUID(),matchId:state.id,type:'move',slotId:'A1',expectedVersion:state.version,expectedTurn:state.turnSerial,path};let reply=await api('command',{command:cmd});state=reply.data.state;assert.match(tutorialHint(state.combat),/habilidad/);assert.deepEqual(await api('command',{command:cmd}),reply);
 cmd={id:crypto.randomUUID(),matchId:state.id,type:'ability',slotId:'A1',expectedVersion:state.version,expectedTurn:state.turnSerial,abilityId:'bow',targetId:'B1'};reply=await api('command',{command:cmd});state=reply.data.state;assert(state.combat.units.find(u=>u.id==='B1').hp<115);assert.match(tutorialHint(state.combat),/Fin de turno/);
});
