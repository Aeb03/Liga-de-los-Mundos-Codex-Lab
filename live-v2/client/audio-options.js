// Panel y preferencias extraídos del offline; selectores LIVE.
(()=>{'use strict';

const STORAGE_KEY='liga-audio-settings-v1';

const DEFAULTS={
  master:1.00,
  music:.40,
  sfx:.92,
  muted:false
};

function clamp(v){
  const n=Number(v);
  return Number.isFinite(n)?Math.max(0,Math.min(1,n)):0;
}

function loadSettings(){
  try{
    const raw=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');
    return{
      master:clamp(raw.master??DEFAULTS.master),
      music:clamp(raw.music??DEFAULTS.music),
      sfx:clamp(raw.sfx??DEFAULTS.sfx),
      muted:!!(raw.muted??DEFAULTS.muted)
    };
  }catch(_){
    return {...DEFAULTS};
  }
}

let settings=loadSettings();

function save(){
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(settings))}catch(_){}
}

function apply(){
  try{
    window.LigaAudio?.setChannelVolume?.('MASTER',settings.master);
    window.LigaAudio?.setChannelVolume?.('MUSIC',settings.music);
    window.LigaAudio?.setChannelVolume?.('SFX_COMBAT',settings.sfx);
    window.LigaAudio?.setChannelVolume?.('SFX_UI',settings.sfx);
    window.LigaAudio?.mute?.(settings.muted);
  }catch(_){}

  try{
    window.LigaMusic?.mute?.(settings.muted);
    window.LigaMusic?.refreshVolume?.();
  }catch(_){}
}

function pct(v){return `${Math.round(v*100)}%`}

function panel(){
  let root=document.getElementById('ligaAudioOptions');
  if(root)return root;

  root=document.createElement('div');
  root.id='ligaAudioOptions';
  root.className='liga-audio-options-backdrop';
  root.hidden=true;
  root.innerHTML=`
    <section class="liga-audio-options-panel" role="dialog" aria-modal="true" aria-label="Opciones del juego">
      <div class="liga-audio-options-head">
        <div><small>OPCIONES</small><b>Juego y audio</b></div>
        <button type="button" class="liga-audio-close" aria-label="Cerrar opciones">×</button>
      </div>

      <div class="liga-audio-row">
        <div><b>Volumen del juego</b><small>Volumen general</small></div>
        <output data-audio-out="master"></output>
        <input data-audio-range="master" type="range" min="0" max="100" step="1">
      </div>

      <div class="liga-audio-row">
        <div><b>Música ambiente</b><small>Lobby y Arenas</small></div>
        <output data-audio-out="music"></output>
        <input data-audio-range="music" type="range" min="0" max="100" step="1">
      </div>

      <div class="liga-audio-row">
        <div><b>Sonidos del juego</b><small>Golpes, habilidades, escudos y estados</small></div>
        <output data-audio-out="sfx"></output>
        <input data-audio-range="sfx" type="range" min="0" max="100" step="1">
      </div>

      <button type="button" class="liga-audio-mute">
        <span class="liga-audio-mute-icon">🔊</span>
        <span><b>Silenciar todo</b><small>Conserva los volúmenes configurados</small></span>
      </button>
      <button type="button" class="liga-tutorial-exit" hidden>Salir del tutorial</button>
      <button type="button" class="danger liga-match-leave" hidden>Abandonar partida</button>
      <div class="liga-exit-actions"><button type="button" class="liga-session-logout" hidden>Cerrar sesión</button><button type="button" class="liga-game-exit">Salir del juego</button></div>
    </section>`;

  const close=()=>{root.hidden=true;root._returnFocus?.focus?.();};
  root.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){const controls=[...root.querySelectorAll('button,input')];const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
  root.querySelector('.liga-audio-close').onclick=close;
  root.querySelector('.liga-tutorial-exit').onclick=()=>{close();window.dispatchEvent(new Event('liga-tutorial-exit'));};
  root.querySelector('.liga-session-logout').onclick=()=>{close();window.dispatchEvent(new Event('liga-session-logout'));};
  root.querySelector('.liga-game-exit').onclick=()=>{close();window.dispatchEvent(new Event('liga-game-exit'));};
  root.querySelector('.liga-match-leave').onclick=()=>{close();document.querySelector('#app .room-bar [data-action="leave"]')?.click();};
  root.addEventListener('pointerdown',e=>{if(e.target===root)close()});

  root.querySelectorAll('[data-audio-range]').forEach(input=>{
    input.addEventListener('input',()=>{
      const key=input.dataset.audioRange;
      settings[key]=clamp(Number(input.value)/100);
      save();
      apply();
      refreshPanel();
    });
  });

  root.querySelector('.liga-audio-mute').onclick=()=>{
    settings.muted=!settings.muted;
    save();
    apply();
    refreshPanel();
  };

  document.body.appendChild(root);
  return root;
}

function refreshPanel(){
  const root=panel();
  for(const key of ['master','music','sfx']){
    const input=root.querySelector(`[data-audio-range="${key}"]`);
    const out=root.querySelector(`[data-audio-out="${key}"]`);
    if(input)input.value=Math.round(settings[key]*100);
    if(out)out.textContent=pct(settings[key]);
  }

  const mute=root.querySelector('.liga-audio-mute');
  const icon=root.querySelector('.liga-audio-mute-icon');
  mute?.classList.toggle('is-muted',settings.muted);
  if(icon)icon.textContent=settings.muted?'🔇':'🔊';
  const title=mute?.querySelector('b');
  if(title)title.textContent=settings.muted?'Activar audio':'Silenciar todo';
}

function open(){
  refreshPanel();
  panel()._returnFocus=document.activeElement;
  panel().querySelector('.liga-match-leave').hidden=!document.body.classList.contains('in-arena')||document.body.classList.contains('tutorial-active');
  panel().querySelector('.liga-tutorial-exit').hidden=!document.body.classList.contains('tutorial-active');
  panel().querySelector('.liga-session-logout').hidden=document.body.dataset.accessMode!=='account';
  panel().querySelector('.liga-game-exit').hidden=!document.body.dataset.accessMode;
  panel().hidden=false;
  panel().querySelector('.liga-audio-close').focus();
}

function makeButton(className,title='Opciones'){
  const b=document.createElement('button');
  b.type='button';
  b.className=className;
  b.title=title;
  b.setAttribute('aria-label',title);
  b.innerHTML='<span aria-hidden="true">⚙️</span><b>Opciones</b>';
  b.onclick=e=>{
    e.stopPropagation();
    open();
  };
  return b;
}

function inject(){
  const lobby=(document.body.dataset.liveAudioScene==='arenaCentral'?null:document.querySelector('body>header'));
  if(lobby&&!lobby.querySelector('.liga-options-lobby')){
    const b=makeButton('liga-options-lobby','Opciones de audio');
    const profile=lobby.querySelector('.profile-chip');
    profile?lobby.insertBefore(b,profile):lobby.appendChild(b);
  }

  const camera=document.querySelector('.live-battle [data-hud-panel="camera"]');
  if(camera&&!camera.querySelector('.liga-options-battle')){
    const b=makeButton('camera-hud-btn liga-options-battle','Opciones de audio');
    b.innerHTML='<span aria-hidden="true">⚙️</span>';
    camera.appendChild(b);
  }
}

apply();
inject();

let queued=false;
new MutationObserver(()=>{
  if(queued)return;
  queued=true;
  requestAnimationFrame(()=>{
    queued=false;
    inject();
  });
}).observe(document.getElementById('app')||document.body,{subtree:true,childList:true});

window.LigaAudioOptions={
  open,
  apply,
  getSettings:()=>({...settings})
};

})();
