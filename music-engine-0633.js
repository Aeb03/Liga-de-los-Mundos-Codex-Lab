(()=>{'use strict';

const CFG=window.LIGA_AUDIO_CONFIG||{channels:{}};
const ROOT='./assets/audio/music/';

const TRACKS={
  lobby:{id:'lobby',src:ROOT+'lobby-liga.mp3?v=0633',loopStart:.52,loopEnd:169.30},
  arenaCentral:{id:'arena-central',src:ROOT+'arena-central-combate.mp3?v=0633',loopStart:.36,loopEnd:156.88}
};

const FADE_MS=650;
const DEFAULT_DUCK=.58;
const RECOVERY_MS=450;

let activated=false;
let lifecycleSuspended=document.visibilityState==='hidden';
let currentScene='none';
let muted=false;
let duckFactor=1;
let duckTimer=null;
let sceneToken=0;
const rafs=new WeakMap();
const expectedPause=new WeakSet();
const recoveryTimers=new WeakMap();

function channel(name,fallback=1){
  const n=Number(CFG?.channels?.[name]);
  return Number.isFinite(n)?Math.max(0,n):fallback;
}
function targetVolume(){
  if(muted)return 0;
  return Math.max(0,Math.min(1,channel('MASTER',1)*channel('MUSIC',.4)*duckFactor));
}
function activePlayer(){
  return currentScene==='lobby'?players.lobby:currentScene==='arenaCentral'?players.arenaCentral:null;
}
function playerIsCurrent(a){return !!a&&a===activePlayer()}

function scheduleRecovery(a,delay=RECOVERY_MS){
  if(!a||!playerIsCurrent(a)||!activated||lifecycleSuspended)return;
  const old=recoveryTimers.get(a);if(old)clearTimeout(old);
  const t=setTimeout(()=>{
    recoveryTimers.delete(a);
    if(playerIsCurrent(a)&&activated&&!lifecycleSuspended&&a.paused){
      safePlay(a).then(ok=>{if(ok)fade(a,targetVolume(),220)}).catch(()=>{});
    }
  },delay);
  recoveryTimers.set(a,t);
}

function makePlayer(track){
  const a=new Audio();
  a.src=track.src;
  a.preload='auto';
  a.loop=false;
  a.dataset.musicTrack=track.id;
  a.volume=0;

  a.addEventListener('timeupdate',()=>{
    try{
      if(Number.isFinite(track.loopEnd)&&a.currentTime>=track.loopEnd){
        a.currentTime=track.loopStart||0;
        if(!a.paused)a.play().catch(()=>scheduleRecovery(a));
      }
    }catch(_){}
  });

  a.addEventListener('ended',()=>{
    try{
      a.currentTime=track.loopStart||0;
      if(playerIsCurrent(a)&&activated&&!lifecycleSuspended){
        a.play().catch(()=>scheduleRecovery(a));
      }
    }catch(_){}
  });

  a.addEventListener('pause',()=>{
    if(expectedPause.has(a)){expectedPause.delete(a);return}
    scheduleRecovery(a);
  });
  a.addEventListener('stalled',()=>scheduleRecovery(a,250));
  a.addEventListener('waiting',()=>scheduleRecovery(a,700));
  a.addEventListener('error',()=>scheduleRecovery(a,900));
  return a;
}

const players={lobby:makePlayer(TRACKS.lobby),arenaCentral:makePlayer(TRACKS.arenaCentral)};

function cancelFade(a){
  const id=rafs.get(a);if(id)cancelAnimationFrame(id);rafs.delete(a);
}
function fade(a,to,ms=FADE_MS,onDone){
  if(!a)return;
  cancelFade(a);
  const from=Number(a.volume)||0,start=performance.now(),duration=Math.max(1,ms);
  const step=now=>{
    const t=Math.min(1,(now-start)/duration),ease=t*t*(3-2*t);
    a.volume=Math.max(0,Math.min(1,from+(to-from)*ease));
    if(t<1){const id=requestAnimationFrame(step);rafs.set(a,id)}
    else{rafs.delete(a);onDone?.()}
  };
  const id=requestAnimationFrame(step);rafs.set(a,id);
}

async function safePlay(a){
  if(!a||lifecycleSuspended)return false;
  try{
    if(a.readyState===0)a.load();
    await a.play();
    return true;
  }catch(_){return false}
}
function pauseExpected(a){
  if(!a||a.paused)return;
  expectedPause.add(a);
  try{a.pause()}catch(_){expectedPause.delete(a)}
}

function sceneFromDOM(){
  const app=document.getElementById('app');
  if(!app)return 'none';
  if(app.querySelector('.battle-screen'))return 'arenaCentral';
  if(app.querySelector('.result-screen'))return 'none';
  if(app.querySelector('.start-screen,.lobby-screen,.mode-screen,.select-screen,.collection-screen,.league-screen,.profile-screen'))return 'lobby';
  return currentScene==='arenaCentral'?'arenaCentral':'lobby';
}

function prewarm(){
  try{
    for(const a of Object.values(players)){
      a.preload='auto';
      if(a.readyState===0)a.load();
    }
  }catch(_){}
}

async function switchScene(next){
  const token=++sceneToken;
  if(next===currentScene){
    const active=activePlayer();
    if(active&&activated&&!lifecycleSuspended){
      if(active.paused){const ok=await safePlay(active);if(ok&&token===sceneToken)fade(active,targetVolume(),220)}
      else fade(active,targetVolume(),160);
    }
    return;
  }

  const prev=currentScene;
  currentScene=next;
  const oldPlayer=prev==='lobby'?players.lobby:prev==='arenaCentral'?players.arenaCentral:null;
  const newPlayer=activePlayer();

  if(oldPlayer&&oldPlayer!==newPlayer){
    fade(oldPlayer,0,300,()=>{if(!playerIsCurrent(oldPlayer))pauseExpected(oldPlayer)});
  }
  if(!newPlayer||!activated||lifecycleSuspended)return;

  const ok=await safePlay(newPlayer);
  if(ok&&token===sceneToken&&playerIsCurrent(newPlayer))fade(newPlayer,targetVolume(),FADE_MS);
}

function sync(){prewarm();switchScene(sceneFromDOM()).catch(()=>{})}
function refreshVolume(){
  const a=activePlayer();
  if(a&&!a.paused)fade(a,targetVolume(),160);
  else if(a&&activated&&!lifecycleSuspended)scheduleRecovery(a,80);
}

async function unlock(){
  activated=true;
  lifecycleSuspended=document.visibilityState==='hidden';
  prewarm();
  sync();
  return true;
}
function setMuted(value){muted=!!value;refreshVolume();return muted}
function duck(level=DEFAULT_DUCK,holdMs=420,releaseMs=280){
  duckFactor=Math.max(.2,Math.min(1,Number(level)||DEFAULT_DUCK));
  refreshVolume();clearTimeout(duckTimer);
  duckTimer=setTimeout(()=>{duckFactor=1;const a=activePlayer();if(a&&!a.paused)fade(a,targetVolume(),releaseMs)},Math.max(80,Number(holdMs)||420));
}
function getState(){
  return{
    version:'0.6.33',activated,lifecycleSuspended,scene:currentScene,muted,duckFactor,
    tracks:{
      lobby:{paused:players.lobby.paused,time:players.lobby.currentTime,readyState:players.lobby.readyState,src:TRACKS.lobby.src},
      arenaCentral:{paused:players.arenaCentral.paused,time:players.arenaCentral.currentTime,readyState:players.arenaCentral.readyState,src:TRACKS.arenaCentral.src}
    }
  };
}
function suspendForLifecycle(){
  if(lifecycleSuspended)return;
  lifecycleSuspended=true;
  for(const a of Object.values(players)){cancelFade(a);pauseExpected(a)}
}
function resumeFromLifecycle(){
  if(!lifecycleSuspended)return;
  lifecycleSuspended=false;
  if(activated)sync();
}

document.addEventListener('visibilitychange',()=>{document.visibilityState==='hidden'?suspendForLifecycle():resumeFromLifecycle()});
window.addEventListener('pagehide',suspendForLifecycle);
window.addEventListener('pageshow',()=>{if(document.visibilityState!=='hidden')resumeFromLifecycle()});
window.addEventListener('focus',()=>{if(activated&&!lifecycleSuspended)sync()});

const firstGesture=()=>{
  unlock();
  document.removeEventListener('pointerdown',firstGesture,true);
  document.removeEventListener('touchstart',firstGesture,true);
  document.removeEventListener('keydown',firstGesture,true);
};
document.addEventListener('pointerdown',firstGesture,true);
document.addEventListener('touchstart',firstGesture,true);
document.addEventListener('keydown',firstGesture,true);

/* Un gesto posterior también recupera audio si Android suspendió el elemento. */
document.addEventListener('pointerdown',()=>{if(activated&&!lifecycleSuspended){const a=activePlayer();if(a?.paused)scheduleRecovery(a,0)}},true);

let queued=false;
new MutationObserver(()=>{
  if(queued)return;queued=true;
  requestAnimationFrame(()=>{queued=false;sync()});
}).observe(document.getElementById('app')||document.body,{subtree:true,childList:true});

/* Watchdog liviano: evita que una pausa inesperada deje la música muerta. */
setInterval(()=>{
  if(!activated||lifecycleSuspended)return;
  const a=activePlayer();
  if(a?.paused)scheduleRecovery(a,0);
},1400);

document.readyState==='loading'?document.addEventListener('DOMContentLoaded',sync,{once:true}):sync();

window.LigaMusic={unlock,sync,switchScene,refreshVolume,mute:setMuted,duck,getState,tracks:{...TRACKS}};

})();
