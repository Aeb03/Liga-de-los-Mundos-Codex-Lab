// Motor WebAudio extraído del offline; hooks sustituidos por cues autoritativos.
(()=>{'use strict';

const CFG=window.LIGA_AUDIO_CONFIG||{channels:{},gains:{}};
const ROOT='../assets/audio/sfx/';

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
  'arfeli.corte_espada':ROOT+'champions/arfeli/corte_espada.mp3',
  'arfeli.impulso':ROOT+'champions/arfeli/impulso.mp3',

  'coloso.absorcion_rocosa':ROOT+'champions/coloso/absorcion_rocosa.mp3',
  'coloso.creacion_pilar':ROOT+'champions/coloso/creacion_pilar.mp3',
  'coloso.golpe_sismico':ROOT+'champions/coloso/golpe_sismico.mp3',
  'coloso.fusion_pilar':ROOT+'champions/coloso/fusion_pilar.mp3',
  'coloso.lanzar_roca':ROOT+'champions/coloso/lanzar_roca.mp3',

  'piplus.ruptura_marca':ROOT+'champions/piplus/ruptura_marca.mp3',
  'piplus.marca':ROOT+'champions/piplus/marca.mp3',
  'piplus.impulso':ROOT+'champions/piplus/impulso.mp3',
  'piplus.flecha_precision':ROOT+'champions/piplus/flecha_precision.mp3',

  'onod.enredaderas':ROOT+'champions/onod/enredaderas.mp3',
  'onod.germinar':ROOT+'champions/onod/germinar.mp3',
  'onod.esporas_toxicas':ROOT+'champions/onod/esporas_toxicas.mp3',
  'onod.espina_venenosa':ROOT+'champions/onod/espina_venenosa.mp3',
  'onod.savia_vital':ROOT+'champions/onod/savia_vital.mp3',

  /* IMPORTANTE: usar los nombres definitivos del pack.
     No intercambiar estos dos archivos. */
  'korgan.trampa_pinchos':ROOT+'champions/korgan/trampa_pinchos.mp3',
  'korgan.trampa_electrica':ROOT+'champions/korgan/trampa_electrica.mp3',
  'korgan.gancho':ROOT+'champions/korgan/gancho.mp3',
  'korgan.granada':ROOT+'champions/korgan/granada.mp3',
  'korgan.disparo_caza':ROOT+'champions/korgan/disparo_caza.mp3',

  'houngan.efigie':ROOT+'champions/houngan/efigie.mp3',
  'houngan.vinculo':ROOT+'champions/houngan/vinculo.mp3',
  'houngan.dolor_reflejado':ROOT+'champions/houngan/dolor_reflejado.mp3',
  'houngan.ritual_dolor':ROOT+'champions/houngan/ritual_dolor.mp3',
  'houngan.transferencia':ROOT+'champions/houngan/transferencia.mp3'
};

const SPECIFIC={
  'arfeli:daggers':'arfeli.dagas_danzantes',
  'arfeli:bow':'arfeli.disparo_arco',
  'arfeli:hammer':'arfeli.golpe_martillo',
  'arfeli:sword':'arfeli.corte_espada',

  'coloso:absorb':'coloso.absorcion_rocosa',
  'coloso:pillar':'coloso.creacion_pilar',
  'coloso:quake':'coloso.golpe_sismico',
  'coloso:rock':'coloso.lanzar_roca',

  'piplus:rupture':'piplus.ruptura_marca',
  'piplus:marker':'piplus.marca',
  'piplus:precise':'piplus.flecha_precision',
  'piplus:impulse':'piplus.impulso',

  'onod:vines':'onod.enredaderas',
  'onod:germinate':'onod.germinar',
  'onod:spores':'onod.esporas_toxicas',
  'onod:thorn':'onod.espina_venenosa',
  'onod:sap':'onod.savia_vital',

  'korgan:hook':'korgan.gancho',
  'korgan:grenade':'korgan.granada',
  'korgan:shot':'korgan.disparo_caza',

  'houngan:doll':'houngan.efigie',
  'houngan:needle':'houngan.vinculo',
  'houngan:reflected':'houngan.dolor_reflejado',
  'houngan:ritual':'houngan.ritual_dolor',
  'houngan:transfer':'houngan.transferencia'
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
let suppressGenericHealUntil=0;
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
    if(!unlocked||document.hidden)return false;
    if(muted)return false;

    const dedupeMs=opts.dedupeMs??70;
    if(!canPassDedupe(key,opts.dedupe,dedupeMs))return false;

    const strong=opts.strong??STRONG.has(key);
    if(strong&&activeStrong>=3)return false;

    const buf=buffers.get(key)||await load(key);
    if(!buf||!ctx||ctx.state!=='running'||muted||document.hidden)return false;

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
    version:'0.6.34',
    unlocked,
    muted,
    contextState:ctx?.state||'unavailable',
    loaded:buffers.size,
    total:Object.keys(FILES).length,
    channels:{...(CFG.channels||{})},
    gains:{...(CFG.gains||{})}
  };
}


// LIVE observa resultados confirmados; no instala hooks de combate offline.
const gesture=()=>{unlock();};
for(const event of ['pointerdown','touchstart','keydown'])document.addEventListener(event,gesture,true);
document.addEventListener('visibilitychange',()=>{if(document.hidden){for(const timer of timers)clearTimeout(timer);timers.clear();ctx?.suspend().catch(()=>{});}else if(unlocked)ctx?.resume().catch(()=>{});});
window.addEventListener('pagehide',()=>{ctx?.suspend().catch(()=>{});});
window.LigaAudio={unlock,preloadCombat,play,schedule,setChannelVolume,setGain,mute:setMuted,getState,files:{...FILES}};
})();
