import test from 'node:test';
import assert from 'node:assert/strict';
import {confirmedAccount,safeText,SocialPanel} from './social.mjs';
test('social access requires confirmed nonanonymous account',()=>{assert.equal(confirmedAccount(null),false);assert.equal(confirmedAccount({is_anonymous:true,email_confirmed_at:'today'}),false);assert.equal(confirmedAccount({is_anonymous:false}),false);assert.equal(confirmedAccount({is_anonymous:false,email_confirmed_at:'today'}),true);});
test('player names cannot introduce markup',()=>{assert.equal(safeText('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;');});
test('account change and invitation acceptance blocked while playing',()=>{const p=new SocialPanel({room:()=>({phase:'combat'})});assert.throws(()=>p.guardRoom(),/Primero/);p.room=()=>({phase:'finished'});assert.doesNotThrow(()=>p.guardRoom());});
