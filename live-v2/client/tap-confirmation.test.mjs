import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createUnit,initializeCombat,calculatePath,previewPath,abilityTargets} from '../combat-core.mjs';
import {sameCell,createAoEState,aoePointerDown,aoePointerUp} from './aoe-preview.mjs';

const source=readFileSync(new URL('./motion-app.mjs',import.meta.url),'utf8');
const handlers=source.slice(source.indexOf('async function confirmSelection(){'),source.indexOf("app.addEventListener('submit'"));
function setup(selection=null){
  const combat=initializeCombat({units:[
    createUnit({championId:'arfeli',id:'a',team:'A',slot:1,controllerId:'one',position:{x:5,y:5}}),
    createUnit({championId:'coloso',id:'b',team:'B',slot:1,controllerId:'two',position:{x:6,y:5}}),
    createUnit({championId:'coloso',id:'c',team:'B',slot:2,controllerId:'two',position:{x:5,y:6}}),
    createUnit({championId:'arfeli',id:'d',team:'A',slot:2,controllerId:'one',position:{x:1,y:1}})
  ],obstacles:[],random:()=>0}).state;
  const commands=[];
  const ctx=vm.createContext({game:{state:{phase:'combat',turnSerial:1,combat},preview:null},
    abilitySelection:selection,movementArmed:!selection,inspectedId:null,
    blocked:()=>false,canMove:()=>true,activeUnit:()=>combat.units[0],
    render:()=>{},notify:()=>{},errors:{},sameCell,key:p=>`${p.x},${p.y}`,
    calculatePath,previewPath,abilityTargets,send:async(type,args)=>{commands.push({type,args});},
    commitAoE:async state=>{commands.push({type:'aoe',args:state});}});
  vm.runInContext(handlers,ctx);
  return {ctx,commands};
}
test('movement selects and changes destination freely; only repeating the destination sends a move',async()=>{
  const {ctx,commands}=setup();
  await ctx.tapCell(4,5);assert.equal(commands.length,0);
  await ctx.tapCell(4,4);assert.equal(commands.length,0);
  await ctx.tapCell(4,4);assert.equal(commands.length,1);
  assert.equal(commands[0].type,'move');
  assert.equal(commands[0].args.path.at(-1).x,4);
  assert.equal(commands[0].args.path.at(-1).y,4);
});
test('ability changes targets without spending an action, then confirms the same target',async()=>{
  const {ctx,commands}=setup({abilityId:'sword',targetId:null});
  await ctx.tapCell(6,5);assert.equal(commands.length,0);
  await ctx.tapCell(5,6);assert.equal(commands.length,0);
  await ctx.tapCell(5,6);assert.equal(commands.length,1);
  assert.equal(commands[0].type,'ability');assert.equal(commands[0].args.targetId,'c');
});
test('button confirmation remains available and blocked or rival turns cannot confirm',async()=>{
  for(const selection of [null,{abilityId:'sword',targetId:null}]){
    const {ctx,commands}=setup(selection),cell=selection?{x:6,y:5}:{x:4,y:5};
    await ctx.tapCell(cell.x,cell.y);
    ctx.blocked=()=>true;await ctx.tapCell(cell.x,cell.y);assert.equal(commands.length,0);
    ctx.blocked=()=>false;ctx.canMove=()=>false;await ctx.tapCell(cell.x,cell.y);assert.equal(commands.length,0);
    ctx.canMove=()=>true;await ctx.confirmSelection();assert.equal(commands.length,1);
  }
});
test('magnetism does not confirm its first target before choosing its second target',async()=>{
  const {ctx,commands}=setup({abilityId:'magnetism',targetId:'b'});
  ctx.magnetismTargets=()=>['c'];
  await ctx.tapCell(6,5);assert.equal(commands.length,0);
  await ctx.tapCell(5,6);assert.equal(commands.length,0);
  await ctx.tapCell(5,6);assert.equal(commands.length,1);
  assert.equal(commands[0].args.targetId,'b');assert.equal(commands[0].args.secondaryTargetId,'c');
});
test('area selection confirms on a repeated cell, including the touch gesture callback',async()=>{
  const {ctx,commands}=setup({abilityId:'grenade',aoe:createAoEState('grenade')});
  ctx.createAoEState=createAoEState;ctx.aoeValidCell=()=>true;
  ctx.syncAoeSelection=next=>{ctx.abilitySelection.aoe=next;};
  await ctx.tapCell(7,5);assert.equal(commands.length,0);
  await ctx.tapCell(7,6);assert.equal(commands.length,0);
  await ctx.tapCell(7,6);assert.equal(commands.length,1);
  commands.length=0;
  ctx.abilitySelection.aoe=aoePointerDown(ctx.abilitySelection.aoe,{x:7,y:6}).state;
  const release=aoePointerUp(ctx.abilitySelection.aoe,{x:7,y:6});
  ctx.abilitySelection.aoe=release.state;assert.equal(release.commit,true);
  const callback=source.match(/onCommit:\(\)=>([^,\n]+)/)[1];
  await vm.runInContext(callback,ctx);assert.equal(commands.length,1);
});
