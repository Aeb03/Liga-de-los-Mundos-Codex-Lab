import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {catalog} from './catalog.mjs';
import {guideSkills,championProfiles,renderGuide} from './champion-guide.mjs';
import {abilityExample} from './guide-examples.mjs';
import {abilityDefinitions,championDefinitions,restoreState,serializeState} from '../combat-core.mjs';
test('guide covers all effective skills with core costs, stats and valid real combat examples',()=>{
 const abilities=abilityDefinitions();assert.deepEqual(Object.keys(championProfiles),Object.keys(catalog));
 for(const [id,c] of Object.entries(catalog)){
  const sheet=renderGuide({championId:id});assert.match(sheet,new RegExp(String(championDefinitions()[id].hp)));assert.equal(guideSkills(id).length,6);
  for(const skill of guideSkills(id)){
   assert.equal(skill.cost,`${abilities[skill.id].cost} PA`);assert(skill.text&&skill.target&&skill.range);
   const ex=abilityExample(id,skill.id);assert.deepEqual(restoreState(serializeState(ex.before)),ex.before);assert.deepEqual(restoreState(serializeState(ex.after)),ex.after);
   assert(ex.events.some(e=>e.type==='ability.used'&&e.abilityId===skill.id));
   assert.notDeepEqual(ex.before,ex.after);
   const detail=renderGuide({championId:id,skillId:skill.id});assert.match(detail,/Cómo funciona/);assert.match(detail,/Resultado/);
   for(const phase of ['before','after'])assert(fs.statSync(new URL(`../assets/guide/${id}-${skill.id}-${phase}.webp`,import.meta.url)).size>1000);
  }
 }
});
test('examples show actual conditional damage, healing, area effects and displacement',()=>{
 const enemy=ex=>ex.after.units.find(u=>u.id==='B1'),actor=ex=>ex.after.units.find(u=>u.id==='A1');
 assert.equal(enemy(abilityExample('piplus','precise')).hp,90);
 assert.equal(enemy(abilityExample('houngan','ritual')).hp,80);
 assert.equal(actor(abilityExample('onod','sap')).hp,82);
 assert.equal(enemy(abilityExample('onod','awakening')).hp,84);
 assert.equal(enemy(abilityExample('onod','vines')).status.vinesSourceId,'A1');
 assert.equal(enemy(abilityExample('piplus','vector')).x,8);
 assert.equal(actor(abilityExample('houngan','paintransfer')).hp,85);
 assert.equal(enemy(abilityExample('houngan','dance')).y,6);
});
