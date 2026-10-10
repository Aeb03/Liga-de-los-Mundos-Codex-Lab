import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { LiveSession, newId } from './session.mjs';
if (!globalThis.crypto) globalThis.crypto=webcrypto;
const state=(version=0)=>({id:'room',version,phase:'combat',turnDeadline:31000});
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};
const envelope=(command,version=1)=>({commandId:command.id,version,confirmed:true,state:state(version)});

test('leaving a room preserves account storage and ignores an in-flight old snapshot',async()=>{
  const saved=storage();saved.setItem('account-session','keep');
  let complete;
  const game=new LiveSession({storage:saved,api:()=>new Promise(resolve=>complete=resolve)});
  game.actor='actor';game.state=state();game.sync.version=0;saved.setItem('live-v2-lab2-match','room');
  const refreshing=game.refresh();game.detach();
  complete({data:state(2)});await refreshing;
  assert.equal(game.state,null);assert.equal(game.sync.version,-1);
  assert.equal(saved.getItem('live-v2-lab2-match'),null);assert.equal(saved.getItem('account-session'),'keep');
});

test('leaving cannot discard an unconfirmed command',()=>{
  const game=new LiveSession({api:async()=>({}),storage:storage()});game.state=state();
  game.sync.beginCommand({id:'pending'});
  assert.throws(()=>game.detach(),/COMMAND_PENDING/);assert.equal(game.state.id,'room');
});

test('respuesta perdida: recupera aceptación sin repetir el movimiento ni retroceder el estado',async()=>{
  let command, recovered=false, sends=0;
  const saved=storage();
  const api=async(op,args)=>{
    if(op==='snapshot')return {data:state(recovered?3:0)};
    if(op==='command'){command=args.command;sends++;throw new Error('network');}
    if(op==='recover')return {data:envelope(command)};
  };
  const game=new LiveSession({api,storage:saved,clock:()=>1000});
  await game.attach('actor',state());game.preview={path:[1,2]};
  assert.equal(await game.send('move',{path:[1,2]}),false);
  assert.equal(game.online,false);assert.equal(game.preview,null);assert(saved.getItem('live-v2-lab2-pending:actor:room'));
  recovered=true;await game.refresh();
  assert.equal(sends,1);assert.equal(game.state.version,3);assert.equal(game.sync.pendingCommand(),null);
  assert.equal(saved.getItem('live-v2-lab2-pending:actor:room'),null);
});

test('recarga: recupera y reenvía exactamente el ID y la versión originales si no se registró',async()=>{
  const saved=storage(), original={id:'original',matchId:'room',type:'move',expectedVersion:0,expectedTurn:1,path:[{x:0,y:0},{x:1,y:0}]};
  saved.setItem('live-v2-lab2-pending:actor:room',JSON.stringify(original));let received;
  const api=async(op,args)=>({data:op==='snapshot'?state(2):op==='recover'?null:(received=args.command,envelope(args.command,3))});
  const game=new LiveSession({api,storage:saved});await game.attach('actor',state(2));
  assert.deepEqual(received,original);assert.equal(game.state.version,3);assert.equal(game.sync.pendingCommand(),null);
});

test('rechazo definitivo libera la acción pendiente y avisa al jugador',async()=>{
  const errors=[];const api=async(op)=>{if(op==='command')throw Object.assign(new Error('VERSION_CONFLICT'),{definitive:true});return {data:state()};};
  const game=new LiveSession({api,storage:storage(),onError:e=>errors.push(e)});await game.attach('actor',state());
  assert.equal(await game.send('move'),false);assert.equal(game.sync.pendingCommand(),null);assert.equal(game.online,true);assert.deepEqual(errors,['VERSION_CONFLICT']);
});

test('rechazo en envelope también se reconoce y no permite marcar la selección como lista',async()=>{
  const game=new LiveSession({api:async(op,args)=>({data:op==='snapshot'?state():{commandId:args.command.id,version:0,rejected:true,error:{code:'BAD_SELECTION'},state:state()}}),storage:storage()});
  await game.attach('actor',state());assert.equal(await game.send('select'),false);assert.equal(game.sync.pendingCommand(),null);
});

test('temporizador usa hora del servidor y bloquea acciones al vencer',async()=>{
  const game=new LiveSession({api:async()=>({data:state(),serverTime:21000}),storage:storage(),clock:()=>1000});
  await game.attach('actor',state());assert.equal(game.remaining(),10);assert.equal(game.canAct(),true);
  game.clock=()=>11000;assert.equal(game.remaining(),0);assert.equal(game.canAct(),false);
});

// A selection shown by the client must always be accepted by the authority catalog.
import { catalog } from './catalog.mjs';
import { EFFECTIVE_SKILLS } from '../server/authoritative-service.mjs';
test('catálogo visible conserva los IDs efectivos que valida el servidor',()=>{
  assert.deepEqual(Object.keys(catalog).sort(),Object.keys(EFFECTIVE_SKILLS).sort());
  for(const [id,champion] of Object.entries(catalog))assert.deepEqual(champion.skills.map(s=>s.id),EFFECTIVE_SKILLS[id]);
});

test('crear sala en HTTP de red local funciona sin crypto.randomUUID',()=>{
  const random={getRandomValues:bytes=>webcrypto.getRandomValues(bytes)};
  const ids=new Set(Array.from({length:32},()=>newId(random)));
  assert.equal(ids.size,32);
  for(const id of ids)assert.match(id,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
