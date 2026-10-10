import test from 'node:test';
import assert from 'node:assert/strict';
import {tutorialSteps,tutorialAllows} from './tutorial.mjs';
const target=selector=>({closest:selectors=>selectors.split(',').map(x=>x.trim()).includes(selector)?{}:null});
test('spotlight gate always admits Options and blocks unrelated commands',()=>{
 const move=tutorialSteps.find(s=>s.id==='move-button');
 assert.equal(tutorialAllows(target('[data-action="moveMode"]'),move),true);
 assert.equal(tutorialAllows(target('[data-action="end"]'),move),false);
 for(const s of tutorialSteps){assert.equal(tutorialAllows(target('.tutorial-options'),s),true);assert.equal(tutorialAllows(target('.liga-audio-options-backdrop'),s),true);}
});
test('action lessons advance on confirmed changes, not mere previews',()=>{
 const move=tutorialSteps.find(s=>s.id==='move-confirm');assert.equal(move.done({own:{pm:3},preview:{cost:1}}),false);assert.equal(move.done({own:{pm:2}}),true);
 const attack=tutorialSteps.find(s=>s.id==='attack');assert.equal(attack.done({enemy:{hp:100,maxHp:100},selection:{targetId:'B1'}}),false);assert.equal(attack.done({enemy:{hp:88,maxHp:100}}),true);
 const area=tutorialSteps.find(s=>s.id==='area-direction');assert.equal(area.done({selection:{direction:{x:0,y:1},aoe:{locked:false}}}),false);assert.equal(area.done({selection:{direction:{x:0,y:1},aoe:{locked:true}}}),true);
});
