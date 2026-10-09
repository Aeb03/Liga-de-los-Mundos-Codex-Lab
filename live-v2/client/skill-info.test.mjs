import test from 'node:test';
import assert from 'node:assert/strict';
import { HOLD_MS, MOVE_TOLERANCE, OFFLINE_SKILL_TEXT, offlineSkillInfo } from './skill-info.mjs';

test('pulsación larga conserva exactamente 1500 ms y tolerancia 14 px del offline',()=>{
  assert.equal(HOLD_MS,1500);
  assert.equal(MOVE_TOLERANCE,14);
});

test('fichas usan textos extraídos del offline efectivo',()=>{
  assert.equal(offlineSkillInfo('arfeli','daggers').text,'10 de daño + Herida 2. Alcance 1. Máximo 1 uso por turno. Maestría con Armas puede aumentar el daño.');
  assert.equal(offlineSkillInfo('coloso','collapse').text,OFFLINE_SKILL_TEXT.collapse);
  assert.equal(offlineSkillInfo('onod','vines').text,OFFLINE_SKILL_TEXT.vines);
  assert.equal(offlineSkillInfo('houngan','dance').range,'Personal · afecta la próxima fase del Muñeco');
});

test('Mina Eléctrica conserva la corrección aprobada posterior al offline: PA inmediato o 12 daño sin PA',()=>{
  const info=offlineSkillInfo('korgan','trap_mine');
  assert.match(info.text,/pierde 1 PA inmediatamente/);
  assert.match(info.text,/12 de daño total/);assert.match(info.text,/No penaliza el próximo turno/);
});
