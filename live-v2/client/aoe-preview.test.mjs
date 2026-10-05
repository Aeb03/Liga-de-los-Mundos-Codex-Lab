import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AOE_ABILITIES,createAoEState,sameCell,aoePointerDown,aoePointerMove,aoePointerUp,aoeCancelDrag
} from './aoe-preview.mjs';

test('AoE sólo se habilita para las cinco habilidades del offline que usan preview global',()=>{
  assert.deepEqual([...AOE_ABILITIES],['vines','grenade','collapse','spores','awakening']);
  assert.equal(createAoEState('thorn'),null);
});

test('AoE arrastra, suelta y queda fijado sin ejecutar en el primer gesto',()=>{
  let state=createAoEState('vines');
  let step=aoePointerDown(state,{x:4,y:4},true);state=step.state;
  assert.equal(state.dragging,true);assert.equal(state.locked,false);assert.deepEqual(state.target,{x:4,y:4});
  step=aoePointerMove(state,{x:5,y:4},true);state=step.state;
  assert.deepEqual(state.target,{x:5,y:4});
  const up=aoePointerUp(state,{x:5,y:4},true,1000);
  assert.equal(up.commit,false);assert.equal(up.state.dragging,false);assert.equal(up.state.locked,true);
  assert.deepEqual(up.state.target,{x:5,y:4});
  assert.equal(up.state.suppressClickUntil,1450);
});

test('segundo toque sobre el centro fijado ejecuta',()=>{
  let state=createAoEState('grenade',{target:{x:6,y:6},locked:true});
  let down=aoePointerDown(state,{x:6,y:6},true);state=down.state;
  assert.equal(down.secondTap,true);assert.equal(state.dragging,false);
  const up=aoePointerUp(state,{x:6,y:6},true,2000);
  assert.equal(up.commit,true);assert.equal(up.state.locked,true);
});

test('un nuevo arrastre desde otra casilla desbloquea y reposiciona el área',()=>{
  let state=createAoEState('vines',{target:{x:4,y:4},locked:true});
  const down=aoePointerDown(state,{x:5,y:4},true);state=down.state;
  assert.equal(state.locked,false);assert.equal(state.dragging,true);assert.deepEqual(state.target,{x:5,y:4});
  const up=aoePointerUp(state,{x:5,y:5},true,3000);
  assert.equal(up.commit,false);assert.equal(up.state.locked,true);assert.deepEqual(up.state.target,{x:5,y:5});
});

test('casilla inválida no mueve ni fija el AoE',()=>{
  const original=createAoEState('vines',{target:{x:4,y:4},locked:true});
  const down=aoePointerDown(original,{x:10,y:10},false);
  assert.equal(down.state.dragging,false);assert.deepEqual(down.state.target,{x:4,y:4});
  const up=aoePointerUp(down.state,{x:10,y:10},false,4000);
  assert.equal(up.commit,false);assert.deepEqual(up.state.target,{x:4,y:4});
});

test('Esporas y Despertar pueden comenzar ya fijadas',()=>{
  const spores=createAoEState('spores',{target:{x:3,y:3},locked:true,mode:'fixed'});
  const awakening=createAoEState('awakening',{target:{x:2,y:5},locked:true,mode:'fixed'});
  assert.equal(spores.locked,true);assert.equal(awakening.locked,true);
  assert(sameCell(spores.target,{x:3,y:3}));
  assert.equal(aoeCancelDrag({...awakening,dragging:true}).dragging,false);
});
