import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {confirmedAudioCues,ConfirmedAudioPlayback} from './audio-cues.mjs';
const combat={units:[{id:'a',championId:'arfeli',shield:[]},{id:'o',championId:'onod',shield:[]}],objects:[]};
const keys=e=>confirmedAudioCues(e,combat).map(c=>c.key);
test('audio uses approved files and aliases, never trap placement or poison-cancelled attack',()=>{
 assert.deepEqual(keys([{type:'ability.used',unitId:'a',abilityId:'sword'}]),['arfeli.corte_espada']);
 assert.deepEqual(keys([{type:'ability.used',unitId:'a',abilityId:'trap_spikes'},{type:'trap.created',trap:{trapType:'spikes',x:1,y:2}}]),[]);
 assert.deepEqual(keys([{type:'ability.used',unitId:'a',abilityId:'trap_mine'}]),[]);
 assert.deepEqual(keys([{type:'trap.triggered',trapType:'mine',x:1,y:2}]),['korgan.trampa_electrica']);
 assert.deepEqual(keys([{type:'piplus.marked'},{type:'object.created',object:{type:'pillar'}},{type:'coloso.action',action:'fusion'}]),['piplus.marca','coloso.creacion_pilar','coloso.fusion_pilar']);
 assert.deepEqual(keys([{type:'ability.used',unitId:'a',abilityId:'sword'},{type:'damage.applied',targetId:'a',source:'poison.ability',killed:true},{type:'unit.died',unitId:'a'}]),['core.ko']);
});
test('real heal/shield/break/KO cues deduplicate and shield expiry stays silent',()=>{
 assert.deepEqual(keys([{type:'unit.healed',amount:0},{type:'shield.expired',amount:10}]),[]);
 assert.deepEqual(keys([{type:'unit.healed',amount:2},{type:'object.healed',amount:3},{type:'shield.added',amount:10},{type:'damage.applied',targetId:'a',absorbed:10},{type:'unit.died',unitId:'a'}]),['core.curacion','core.escudo','core.ruptura_escudo','core.ko']);
 assert.deepEqual(keys([{type:'ability.used',unitId:'o',abilityId:'sap'},{type:'unit.healed',amount:8}]),['onod.savia_vital']);
});
test('version history plays once across command/poll, first attach/reconnect/background never replays history',()=>{
 const heard=[],audio=new ConfirmedAudioPlayback({clock:()=>10000,play:(key)=>heard.push(key)});
 const state=(version,batches=[])=>({id:'m',version,presentation:{audio:batches}});
 const batch=(version,time=10000)=>({version,serverTime:time,cues:[{key:'core.escudo',delay:0}]});
 audio.receive(state(1,[batch(1)]));assert.deepEqual(heard,[]);
 audio.receive(state(2,[batch(1),batch(2)]));audio.receive(state(2,[batch(2)]));assert.equal(heard.length,1);
 audio.receive(state(3,[batch(3)]),{audible:false});audio.receive(state(3,[batch(3)]));assert.equal(heard.length,1);
 audio.suspend();audio.receive(state(4,[batch(4)]));assert.equal(heard.length,1);
 audio.receive(state(5,[batch(5,1000)]));assert.equal(heard.length,1);
 audio.receive(state(7,[batch(6),batch(7)]));assert.equal(heard.length,3);
 audio.receive({...state(9,[batch(9)]),id:'another'});assert.equal(heard.length,3);
});
test('all approved MP3 assets exist and offline defaults/storage are preserved',()=>{
 const listeners={},window={LIGA_AUDIO_CONFIG:{channels:{}},addEventListener(){}};
 const ctx={window,document:{addEventListener:(key,fn)=>listeners[key]=fn},Map,Set,performance:{now:()=>0}};
 vm.runInNewContext(fs.readFileSync(new URL('./client/audio-engine.js',import.meta.url),'utf8'),ctx);
 for(const path of Object.values(window.LigaAudio.files))assert(fs.existsSync(new URL(path,new URL('./client/../',import.meta.url))));
 const source=fs.readFileSync(new URL('./client/audio-options.js',import.meta.url),'utf8');
 assert(source.includes("'liga-audio-settings-v1'"));assert(source.includes('master:1.00'));assert(source.includes('music:.40'));assert(source.includes('sfx:.92'));
 assert(!source.includes('executeAbility'));assert(!fs.readFileSync(new URL('./client/audio-engine.js',import.meta.url),'utf8').includes('installAbilityHook'));
});

test('settings load defaults, saved preferences and damaged storage without DOM hooks',()=>{
 const execute=raw=>{
  const values={},window={LigaAudio:{setChannelVolume:(channel,v)=>values[channel]=v,mute:v=>values.muted=v},LigaMusic:{mute(){},refreshVolume(){}}};
  const context={window,document:{body:{dataset:{}},querySelector:()=>null,getElementById:()=>null},localStorage:{getItem:()=>raw},MutationObserver:class{observe(){}},requestAnimationFrame(){}};
  vm.runInNewContext(fs.readFileSync(new URL('./client/audio-options.js',import.meta.url),'utf8'),context);
  return {settings:JSON.parse(JSON.stringify(window.LigaAudioOptions.getSettings())),values};
 };
 assert.deepEqual(execute(null).settings,{master:1,music:.4,sfx:.92,muted:false});
 const saved=execute('{"master":0.7,"music":0.2,"sfx":0.5,"muted":true}');
 assert.deepEqual(saved.values,{MASTER:.7,MUSIC:.2,SFX_COMBAT:.5,SFX_UI:.5,muted:true});
 assert.deepEqual(execute('bad-json').settings,execute(null).settings);
});
test('audio graph waits for gesture, respects mute and stops while hidden',async()=>{
 const listeners={},started=[],gains=[];
 class AudioContext{
  constructor(){this.state='suspended';this.destination={};}
  createGain(){const node={gain:{value:0},connect(){},disconnect(){}};gains.push(node);return node;}
  resume(){this.state='running';return Promise.resolve();}
  suspend(){this.state='suspended';return Promise.resolve();}
  decodeAudioData(){return Promise.resolve({});}
  createBufferSource(){return {connect(){},disconnect(){},start:()=>started.push(true)};}
 }
 const document={hidden:false,addEventListener:(name,fn)=>listeners[name]=fn};
 const window={AudioContext,LIGA_AUDIO_CONFIG:{channels:{MASTER:1,SFX_COMBAT:.92}},addEventListener(){}};
 const ctx={window,document,fetch:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(2)}),performance:{now:()=>1000},setTimeout,clearTimeout,Map,Set};
 vm.runInNewContext(fs.readFileSync(new URL('./client/audio-engine.js',import.meta.url),'utf8'),ctx);
 const audio=window.LigaAudio;assert.equal(await audio.play('core.escudo'),false);assert.equal(gains.length,0);
 await audio.unlock();await audio.preloadCombat();assert.equal(await audio.play('core.escudo',{dedupe:'1'}),true);
 audio.mute(true);assert.equal(gains[0].gain.value,0);assert.equal(await audio.play('core.escudo',{dedupe:'2'}),false);
 audio.mute(false);document.hidden=true;listeners.visibilitychange();assert.equal(await audio.play('core.escudo',{dedupe:'3'}),false);
 document.hidden=false;listeners.visibilitychange();assert.equal(await audio.play('core.escudo',{dedupe:'4'}),true);assert.equal(started.length,2);
});

test('music preserves offline tracks/loops, scene change and background pause',async()=>{
 const players=[],listeners={},frames=[];
 class Audio{
  constructor(){this.paused=true;this.readyState=1;this.dataset={};this.currentTime=0;this.volume=0;this.listeners={};players.push(this);}
  addEventListener(key,fn){this.listeners[key]=fn;}
  load(){}
  play(){this.paused=false;return Promise.resolve();}
  pause(){this.paused=true;this.listeners.pause?.();}
 }
 const document={visibilityState:'visible',readyState:'complete',body:{dataset:{liveAudioScene:'lobby'}},getElementById:()=>null,addEventListener:(key,fn)=>listeners[key]=fn,removeEventListener(){}};
 const window={LIGA_AUDIO_CONFIG:{channels:{MASTER:1,MUSIC:.4}},addEventListener(){}};
 const ctx={window,document,Audio,performance:{now:()=>0},requestAnimationFrame:fn=>{frames.push(fn);return frames.length},cancelAnimationFrame(){},setInterval(){},setTimeout:()=>1,clearTimeout(){},MutationObserver:class{observe(){}},WeakMap,WeakSet};
 vm.runInNewContext(fs.readFileSync(new URL('./client/music-engine.js',import.meta.url),'utf8'),ctx);
 const music=window.LigaMusic;assert(players.every(p=>p.paused));
 await music.unlock();await Promise.resolve();assert.equal(players[0].paused,false);
 for(const fn of frames.splice(0))fn(10000);assert.equal(players[0].volume,.4);
 document.body.dataset.liveAudioScene='arenaCentral';music.sync();await Promise.resolve();
 for(const fn of frames.splice(0))fn(10000);assert.equal(players[0].paused,true);assert.equal(players[1].paused,false);
 players[1].currentTime=156.9;players[1].listeners.timeupdate();assert.equal(players[1].currentTime,.36);
 document.visibilityState='hidden';listeners.visibilitychange();assert(players.every(p=>p.paused));
 document.visibilityState='visible';listeners.visibilitychange();await Promise.resolve();assert.equal(players[1].paused,false);
 document.body.dataset.liveAudioScene='none';music.sync();await Promise.resolve();for(const fn of frames.splice(0))fn(10000);assert(players.every(p=>p.paused));
 assert.equal(music.getState().scene,'none');
});
