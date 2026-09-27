(()=>{'use strict';

const CFG=window.LIGA_AUDIO_CONFIG||{channels:{},gains:{}};
const ROOT='./assets/audio/sfx/';

const FILES={
  'core.impacto':ROOT+'core/impacto.mp3',
  'core.curacion':ROOT+'core/curacion.mp3',
  'core.escudo':ROOT+'core/escudo.mp3',
  'core.ruptura_escudo':ROOT+'core/ruptura_escudo.mp3',
  'core.proyectil':ROOT+'core/proyectil.mp3',
  'core.area':ROOT+'core/area.mp3',
  'core.aparicion':ROOT+'core/aparicion.mp3',
  'core.ko':ROOT+'core/ko.mp3',

  'arfeli.dagas_danzantes':ROOT+'champions/arfeli/dagas_danzantes.mp3',
  'arfeli.disparo_arco':ROOT+'champions/arfeli/disparo_arco.mp3',
  'arfeli.golpe_martillo':ROOT+'champions/arfeli/golpe_martillo.mp3',

  'coloso.absorcion_rocosa':ROOT+'champions/coloso/absorcion_rocosa.mp3',
  'coloso.creacion_pilar':ROOT+'champions/coloso/creacion_pilar.mp3',
  'coloso.golpe_sismico':ROOT+'champions/coloso/golpe_sismico.mp3',

  'piplus.ruptura_marca':ROOT+'champions/piplus/ruptura_marca.mp3',
  'piplus.marca':ROOT+'champions/piplus/marca.mp3',
  'piplus.impulso':ROOT+'champions/piplus/impulso.mp3',

  'onod.enredaderas':ROOT+'champions/onod/enredaderas.mp3',
  'onod.germinar':ROOT+'champions/onod/germinar.mp3',
  'onod.esporas_toxicas':ROOT+'champions/onod/esporas_toxicas.mp3',

  /* IMPORTANTE: usar los nombres definitivos del pack.
     No intercambiar estos dos archivos. */
  'korgan.trampa_pinchos':ROOT+'champions/korgan/trampa_pinchos.mp3',
  'korgan.trampa_electrica':ROOT+'champions/korgan/trampa_electrica.mp3',
  'korgan.gancho':ROOT+'champions/korgan/gancho.mp3',

  'houngan.efigie':ROOT+'champions/houngan/efigie.mp3',
  'houngan.vinculo':ROOT+'champions/houngan/vinculo.mp3',
  'houngan.dolor_reflejado':ROOT+'champions/houngan/dolor_reflejado.mp3'
};

const SPECIFIC={
  'arfeli:daggers':'arfeli.dagas_danzantes',
  'arfeli:bow':'arfeli.disparo_arco',
  'arfeli:hammer':'arfeli.golpe_martillo',

  'coloso:absorb':'coloso.absorcion_rocosa',
  'coloso:pillar':'coloso.creacion_pilar',
  'coloso:quake':'coloso.golpe_sismico',

  'piplus:rupture':'piplus.ruptura_marca',
  'piplus:marker':'piplus.marca',

  'onod:vines':'onod.enredaderas',
  'onod:germinate':'onod.germinar',
  'onod:spores':'onod.esporas_toxicas',

  'korgan:hook':'korgan.gancho',

  'houngan:doll':'houngan.efigie',
  'houngan:needle':'houngan.vinculo',
  'houngan:reflected':'houngan.dolor_reflejado'
};

const STRONG=new Set([
  'core.area','core.ruptura_escudo','core.ko',
  'arfeli.golpe_martillo',
  'coloso.golpe_sismico',
  'piplus.ruptura_marca',
  'onod.esporas_toxicas',
  'korgan.trampa_pinchos','korgan.trampa_electrica',
  'houngan.dolor_reflejado'
]);

let ctx=null;
let nodes=null;
let unlocked=false;
let muted=false;
let preloading=null;
let activeStrong=0;
const buffers=new Map();
const loading=new Map();
const lastPlay=new Map();
const timers=new Set();

function gainOf(key){
  const n=Number(CFG?.gains?.[key]);
  return Number.isFinite(n)?Math.max(0,n):1;
}
function channelValue(name){
  const n=Number(CFG?.channels?.[name]);
  return Number.isFinite(n)?Math.max(0,n):1;
}

function buildGraph(){
  if(ctx&&nodes)return true;
  const Ctx=window.AudioContext||window.webkitAudioContext;
  if(!Ctx)return false;

  ctx=new Ctx();
  const master=ctx.createGain();
  const music=ctx.createGain();
  const combat=ctx.createGain();
  const ui=ctx.createGain();

  master.gain.value=muted?0:channelValue('MASTER');
  music.gain.value=channelValue('MUSIC');
  combat.gain.value=channelValue('SFX_COMBAT');
  ui.gain.value=channelValue('SFX_UI');

  music.connect(master);
  combat.connect(master);
  ui.connect(master);
  master.connect(ctx.destination);

  nodes={MASTER:master,MUSIC:music,SFX_COMBAT:combat,SFX_UI:ui};
  return true;
}

async function unlock(){
  try{
    if(!buildGraph())return false;
    if(ctx.state==='suspended')await ctx.resume();
    unlocked=ctx.state==='running';
    if(unlocked)preloadCombat();
    return unlocked;
  }catch(_){
    return false;
  }
}

async function load(key){
  if(buffers.has(key))return buffers.get(key);
  if(loading.has(key))return loading.get(key);
  const url=FILES[key];
  if(!url||!buildGraph())return null;

  const promise=(async()=>{
    try{
      const r=await fetch(url,{cache:'force-cache'});
      if(!r.ok)throw new Error('audio '+r.status);
      const data=await r.arrayBuffer();
      const buf=await ctx.decodeAudioData(data.slice(0));
      buffers.set(key,buf);
      return buf;
    }catch(_){
      return null;
    }finally{
      loading.delete(key);
    }
  })();

  loading.set(key,promise);
  return promise;
}

function preloadCombat(){
  if(preloading)return preloading;
  if(!buildGraph())return Promise.resolve(false);
  preloading=Promise.allSettled(Object.keys(FILES).map(load))
    .then(()=>true)
    .catch(()=>false);
  return preloading;
}

function canPassDedupe(key,tag,ms){
  const k=tag||key;
  const now=performance.now();
  const last=lastPlay.get(k)||-Infinity;
  if(now-last<(ms||0))return false;
  lastPlay.set(k,now);
  return true;
}

async function play(key,opts={}){
  try{
    if(!unlocked){
      const ok=await unlock();
      if(!ok)return false;
    }
    if(muted)return false;

    const dedupeMs=opts.dedupeMs??70;
    if(!canPassDedupe(key,opts.dedupe,dedupeMs))return false;

    const strong=opts.strong??STRONG.has(key);
    if(strong&&activeStrong>=3)return false;

    const buf=buffers.get(key)||await load(key);
    if(!buf||!ctx||ctx.state!=='running')return false;

    const source=ctx.createBufferSource();
    const g=ctx.createGain();
    const channel=opts.channel||'SFX_COMBAT';
    const target=nodes?.[channel]||nodes?.SFX_COMBAT;
    if(!target)return false;

    source.buffer=buf;
    const requested=Number(opts.gain);
    g.gain.value=gainOf(key)*(Number.isFinite(requested)?Math.max(0,requested):1);

    source.connect(g);
    g.connect(target);

    if(strong)activeStrong++;
    source.onended=()=>{
      if(strong)activeStrong=Math.max(0,activeStrong-1);
      try{source.disconnect();g.disconnect()}catch(_){}
    };

    source.start(0);
    return true;
  }catch(_){
    return false;
  }
}

function schedule(key,delay=200,opts={}){
  const t=setTimeout(()=>{
    timers.delete(t);
    play(key,opts);
  },Math.max(0,delay));
  timers.add(t);
  return t;
}

function setChannelVolume(name,value){
  const v=Math.max(0,Number(value)||0);
  CFG.channels=CFG.channels||{};
  CFG.channels[name]=v;
  if(nodes?.[name])nodes[name].gain.value=(name==='MASTER'&&muted)?0:v;
  return v;
}
function setGain(key,value){
  const v=Math.max(0,Number(value)||0);
  CFG.gains=CFG.gains||{};
  CFG.gains[key]=v;
  return v;
}
function setMuted(value){
  muted=!!value;
  if(nodes?.MASTER)nodes.MASTER.gain.value=muted?0:channelValue('MASTER');
  return muted;
}
function getState(){
  return{
    version:'0.6.0',
    unlocked,
    muted,
    contextState:ctx?.state||'unavailable',
    loaded:buffers.size,
    total:Object.keys(FILES).length,
    channels:{...(CFG.channels||{})},
    gains:{...(CFG.gains||{})}
  };
}

/* ---------------------------------------------------------
   REGLAS DE LECTURA DE HABILIDADES
   --------------------------------------------------------- */
function genericCue(u,id){
  /* Las trampas de Korgan son invisibles:
     NO revelamos su tipo al colocarlas. Suenan al ACTIVARSE. */
  if(id==='trap_spikes'||id==='trap_snare'||id==='trap_bomb')return;

  if(['rock','precise','shot','thorn'].includes(id)){
    play('core.proyectil',{strong:false,dedupe:`projectile:${u?.id||''}`,dedupeMs:90});
    schedule('core.impacto',210,{strong:false,dedupe:`impact:${u?.id||''}`,dedupeMs:120,gain:.92});
    return;
  }

  if(['sword','spear','vector','curse','ritual'].includes(id)){
    schedule('core.impacto',165,{strong:false,dedupe:`impact:${u?.id||''}`,dedupeMs:110});
    return;
  }

  if(id==='awakening'){
    schedule('core.area',150,{dedupe:'area-action',dedupeMs:250});
    return;
  }

  if(id==='fusion'){
    play('core.aparicion',{strong:false,dedupe:'appearance',dedupeMs:180});
    return;
  }

  /* curación y escudo salen de los eventos reales heal/addShield,
     no de una predicción de habilidad. */
}

function abilityCue(u,id){
  const key=SPECIFIC[`${u?.championId||''}:${id}`];
  if(key){
    play(key,{dedupe:`ability:${u?.id||''}:${id}`,dedupeMs:120});
    return;
  }
  genericCue(u,id);
}

/* ---------------------------------------------------------
   HOOKS. Todos son feedback y fallan en silencio.
   --------------------------------------------------------- */
function installAbilityHook(){
  if(typeof executeAbility!=='function'||executeAbility.__ligaAudio0600)return;
  const original=executeAbility;
  const hooked=async function(u,id,x,y,fromAI=false){
    let valid=true;
    try{valid=typeof canUseAbility==='function'?!!canUseAbility(u,id,x,y):true}catch(_){}
    if(valid)abilityCue(u,id);
    return original(u,id,x,y,fromAI);
  };
  hooked.__ligaAudio0600=true;
  executeAbility=hooked;
}

function installImpulseHook(){
  if(typeof executeImpulse!=='function'||executeImpulse.__ligaAudio0600)return;
  const original=executeImpulse;
  const hooked=async function(u,target,x,y){
    /* executeImpulse ya valida antes de modificar la lógica.
       Hacemos una validación liviana para no sonar en intentos inválidos. */
    let valid=true;
    try{
      valid=!!(u&&target&&u.pa>=ability(u.championId,'impulse').cost&&
        impulseTargetValid(u,target)&&straightDashValidFrom(target,x,y,2));
    }catch(_){}
    if(valid)play('piplus.impulso',{dedupe:`ability:${u?.id||''}:impulse`,dedupeMs:120});
    return original(u,target,x,y);
  };
  hooked.__ligaAudio0600=true;
  executeImpulse=hooked;
}

function installTrapHook(){
  if(typeof triggerTrapAt!=='function'||triggerTrapAt.__ligaAudio0600)return;
  const original=triggerTrapAt;
  const hooked=async function(target){
    let trap=null;
    try{
      trap=typeof B!=='undefined'
        ?B?.traps?.find(t=>t.active&&t.side!==target?.side&&t.x===target?.x&&t.y===target?.y)
        :null;
    }catch(_){}

    if(trap){
      if(trap.trapType==='spikes'){
        play('korgan.trampa_pinchos',{dedupe:`trap:${trap.id||trap.x+','+trap.y}`,dedupeMs:400});
      }else if(trap.trapType==='mine'||trap.trapType==='snare'){
        play('korgan.trampa_electrica',{dedupe:`trap:${trap.id||trap.x+','+trap.y}`,dedupeMs:400});
      }else if(trap.trapType==='bomb'){
        play('core.area',{dedupe:`trap:${trap.id||trap.x+','+trap.y}`,dedupeMs:400});
      }
    }
    return original(target);
  };
  hooked.__ligaAudio0600=true;
  triggerTrapAt=hooked;
}

function installHealHook(){
  if(typeof heal!=='function'||heal.__ligaAudio0600)return;
  const original=heal;
  const hooked=function(e,n){
    let before=0;
    try{before=Number(e?.hp)||0}catch(_){}
    const result=original(e,n);
    try{
      const gained=Math.max(0,(Number(e?.hp)||0)-before);
      if(gained>0){
        play('core.curacion',{
          strong:false,
          dedupe:'result:heal',
          dedupeMs:170,
          gain:.96
        });
      }
    }catch(_){}
    return result;
  };
  hooked.__ligaAudio0600=true;
  heal=hooked;
}

function installShieldHook(){
  if(typeof addShield!=='function'||addShield.__ligaAudio0600)return;
  const original=addShield;
  const hooked=function(e,amount,label){
    let before=0;
    try{before=(e?.shieldStacks||[]).reduce((n,s)=>n+(s?.amount||0),0)}catch(_){}
    const result=original(e,amount,label);
    try{
      const after=(e?.shieldStacks||[]).reduce((n,s)=>n+(s?.amount||0),0);
      if(after>before){
        play('core.escudo',{
          strong:false,
          dedupe:`result:shield:${e?.id||''}`,
          dedupeMs:160
        });
      }
    }catch(_){}
    return result;
  };
  hooked.__ligaAudio0600=true;
  addShield=hooked;
}

function installDamageHook(){
  if(typeof applyDamage!=='function'||applyDamage.__ligaAudio0600)return;
  const original=applyDamage;
  const hooked=function(e,n,...rest){
    let shieldBefore=0,aliveBefore=false;
    try{
      shieldBefore=(e?.shieldStacks||[]).reduce((sum,s)=>sum+(s?.amount||0),0);
      aliveBefore=!!e?.alive;
    }catch(_){}

    const result=original(e,n,...rest);

    try{
      const shieldAfter=(e?.shieldStacks||[]).reduce((sum,s)=>sum+(s?.amount||0),0);

      if(shieldBefore>0&&shieldAfter<=0){
        play('core.ruptura_escudo',{
          dedupe:`shield-break:${e?.id||''}`,
          dedupeMs:250
        });
      }

      if(aliveBefore&&e?.alive===false&&e?.kind==='unit'){
        schedule('core.ko',shieldBefore>0&&shieldAfter<=0?180:70,{
          dedupe:`ko:${e?.id||''}`,
          dedupeMs:1200
        });
      }
    }catch(_){}

    return result;
  };
  hooked.__ligaAudio0600=true;
  applyDamage=hooked;
}

function install(){
  try{installAbilityHook()}catch(_){}
  try{installImpulseHook()}catch(_){}
  try{installTrapHook()}catch(_){}
  try{installHealHook()}catch(_){}
  try{installShieldHook()}catch(_){}
  try{installDamageHook()}catch(_){}
}

/* Primer gesto real del usuario: desbloquear y precargar ~0.4 MB de SFX. */
const firstGesture=()=>{
  unlock();
  document.removeEventListener('pointerdown',firstGesture,true);
  document.removeEventListener('touchstart',firstGesture,true);
  document.removeEventListener('keydown',firstGesture,true);
};
document.addEventListener('pointerdown',firstGesture,true);
document.addEventListener('touchstart',firstGesture,true);
document.addEventListener('keydown',firstGesture,true);

install();

/* Si otro script reemplaza una función durante el arranque, reintentar una vez
   al terminar de cargar sin tocar mecánicas. */
window.addEventListener('load',()=>{install();},{once:true});

window.LigaAudio={
  unlock,
  preloadCombat,
  play,
  schedule,
  setChannelVolume,
  setGain,
  mute:setMuted,
  getState,
  files:{...FILES}
};

})();