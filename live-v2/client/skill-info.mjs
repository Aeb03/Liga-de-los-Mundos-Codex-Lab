import { catalog } from './catalog.mjs?v=20261009-sapmine1';

export const HOLD_MS=1500;
export const MOVE_TOLERANCE=14;

// Textos extraídos de los reworks offline efectivos congelados en 0b498395.
// Reglas actuales: las penalizaciones se acumulan para el próximo turno del afectado.
export const OFFLINE_SKILL_TEXT=Object.freeze({
  sword:'10 de daño. Alcance 1. Máximo 2 usos por turno. Maestría con Armas puede aumentar el daño.',
  daggers:'10 de daño + Herida 2. Alcance 1. Máximo 1 uso por turno. Maestría con Armas puede aumentar el daño.',
  bow:'8 de daño. Alcance 4. Requiere línea de visión. Maestría con Armas puede aumentar el daño.',
  spear:'10 de daño y atrae al objetivo 1 casilla hacia Arfeli. Alcance 2. Requiere línea de visión. Maestría con Armas puede aumentar el daño.',
  shield:'Arfeli obtiene 15 de Escudo. Máximo 1 uso por turno. Maestría con Armas suma su bonificación al Escudo. El Escudo dura hasta el inicio del próximo turno de Arfeli o hasta romperse.',
  hammer:'Elegí una entidad enemiga a alcance 3. Arfeli salta a una casilla cardinal libre adyacente al objetivo, ignorando obstáculos y línea de visión, e inflige 13 de daño. Maestría con Armas puede aumentar el daño.',
  rock:'8 de daño. Alcance 4; en Monolito, alcance 5. Requiere línea de visión.',
  stonearmor:'Otorga 10 de Escudo a Coloso, un aliado o un Pilar propio a alcance 3. Máximo 2 usos por turno y cada objetivo sólo puede recibirla 1 vez por turno. El Escudo expira al inicio del próximo turno de Coloso o al romperse.',
  absorb:'Consume un Pilar propio a alcance 3 y cura hasta 15 PV reales a Coloso. No puede consumir un Pilar creado durante el mismo turno. Requiere línea de visión.',
  quake:'Desde Coloso: 10 de daño + empuje 1. En Monolito también puede originarse desde un Pilar: 8 de daño + empuje 1. Después pueden activarse Réplicas desde Pilares propios ortogonalmente adyacentes: 6 de daño + empuje 1 por Pilar, máximo 1 vez cada uno. Un empuje bloqueado añade +2 de daño de colisión.',
  collapse:'Seleccioná un Pilar propio a alcance 3; en Monolito, alcance 5. No puede usar un Pilar invocado este turno. Se consume y golpea una línea de 3 casillas en la dirección elegida. Daño según los PV actuales del Pilar: cercana PV, media máx.(0, PV−2), lejana máx.(0, PV−4). El área se previsualiza antes de lanzar.',
  magnetism:'Seleccioná un Pilar propio a alcance 3; en Monolito, alcance 5. Luego elegí un combatiente a distancia Manhattan 5 del Pilar y atraelo hasta 2 casillas hacia él. Herida y trampas se activan normalmente durante el desplazamiento.',
  precise:'8 de daño; 10 si el objetivo está Marcado. Alcance 4. Requiere línea de visión salvo que Fijación de Objetivo esté activa sobre ese Marcado.',
  vector:'6 de daño + empuje 1. Si el objetivo está Marcado, empuja 2. Alcance 3. Requiere línea de visión salvo que Fijación de Objetivo esté activa.',
  impulse:'Piplus se desplaza 1 o 2 casillas en línea sin gastar PM. Puede atravesar obstáculos, pero debe terminar en una casilla válida y libre. Máximo 1 uso por turno. Si empieza adyacente a un enemigo y se desplaza directamente alejándose de él, primero empuja a ese enemigo 1 casilla en dirección opuesta y luego se mueve.',
  interference:'Sólo contra el enemigo Marcado. Le aplica −1 PM acumulable al inicio de su próximo turno, durante ese turno. Cada rival puede recibir Interferencia como máximo 1 vez por turno de Piplus. Requiere línea de visión salvo que Fijación de Objetivo esté activa.',
  rupture:'Sólo contra el enemigo Marcado. Inflige 14 de daño y consume la Marca. Después de usarla, Marcar Objetivo queda bloqueado durante el resto del turno. Requiere línea de visión salvo que Fijación de Objetivo esté activa.',
  fixation:'Sólo contra el enemigo Marcado. La próxima habilidad ofensiva usada contra ese objetivo durante este turno ignora la línea de visión y luego consume la Fijación. La Marca permanece. Si no se usa, Fijación expira al terminar el turno.',
  thorn:'6 de daño + Veneno 1. Alcance 4. Requiere línea de visión. Máximo 2 usos por turno.',
  vines:'Elegí una casilla a alcance 3. Área en cruz de 5 casillas: centro 6 de daño y las 4 cardinales 4 de daño. Los combatientes enemigos alcanzados acumulan −1 PM por aplicación al inicio de su próximo turno, durante ese turno. Requiere línea de visión hacia la casilla central.',
  sap:'Cura 10 PV a Onod o a un aliado a alcance 3, más 2 PV por cada Brote propio ortogonalmente adyacente al objetivo. Cada campeón sólo puede recibir Savia una vez por turno de Onod. Requiere línea de visión.',
  spores:'Elegí cualquier Brote propio activo, sin límite de distancia desde Onod. El Brote no se consume. Los 8 espacios que lo rodean se previsualizan; cada enemigo dentro recibe 8 de daño y Veneno 1.',
  awakening:'Activa simultáneamente TODOS los Brotes propios sin consumirlos. Cada Brote inflige 8 de daño a enemigos ortogonalmente adyacentes. El daño se acumula: un enemigo alcanzado por 2 Brotes recibe 16; por 3, recibe 24.',
  reabsorption:'Absorbe obligatoriamente TODOS los Brotes propios creados en turnos anteriores. Los Brotes creados este turno no pueden absorberse. Cada Brote absorbido desaparece y otorga +1 PA. Después de usar Reabsorción, Germinar queda bloqueado durante el resto del turno.',
  trap_spikes:'Coloca una trampa invisible a alcance 3. Máximo 2 colocaciones por turno y máximo 3 trampas activas. Al activarse: 10 de daño + Herida 1. Se consume.',
  trap_mine:'Coloca una mina invisible a alcance 3. Máximo 1 colocación por turno y máximo 3 trampas activas. Al activarse: Si el combatiente tiene PA: 8 de daño y pierde 1 PA inmediatamente. Si tiene 0 PA: 12 de daño total. No penaliza el próximo turno. Se consume.',
  grenade:'Elegí una casilla, incluso vacía, a alcance 3 con línea de visión. Área en cruz: centro 10 de daño sin empuje; las 4 cardinales reciben 6 de daño y, si son combatientes, empuje 1 hacia afuera. El área se previsualiza antes de lanzar.',
  shot:'10 de daño. Alcance 5, sólo en la misma fila o columna que Korgan. Requiere línea de visión.',
  hook:'6 de daño a un combatiente enemigo a alcance 3 con línea de visión. Korgan elige atraerlo 1 o 2 casillas, paso a paso. Herida y trampas se activan normalmente durante la atracción.',
  hunterstep:'Korgan se desplaza 1 o 2 casillas en línea sin gastar PM. El recorrido debe estar libre. Herida y trampas se resuelven por cada casilla recorrida. Máximo 1 uso por turno.',
  needle:'Alcance 4 + línea de visión. Enemigo: 6 de daño + Vínculo. Aliado: cura 6 PV + Vínculo. Hougan no puede Vincularse a sí mismo.',
  transfer:'Elegí un Muñeco propio a alcance 3 + línea de visión. Hougan recupera hasta 8 PV y el Muñeco pierde exactamente la cantidad de PV realmente recuperada. No puede usarse con Hougan a vida completa. La pérdida real del Muñeco activa normalmente su efecto si está activo.',
  ritual:'Sólo contra el enemigo actualmente Vinculado, a alcance 4 + línea de visión. Inflige 14 de daño. Si el Muñeco correspondiente está ortogonalmente adyacente al objetivo, inflige 20 en total. Consume el Vínculo; el Muñeco permanece en tablero pero queda inactivo.',
  curse:'8 de daño + Veneno 1 a un enemigo a alcance 3. No requiere Vínculo ni línea de visión. Máximo 1 uso por turno.',
  paintransfer:'Requiere Vínculo actual y el Muñeco correspondiente activo. Mientras ambos sigan coincidiendo, todo daño que reciba Hougan se divide 50/50 entre Hougan y el Muñeco; si el daño es impar, Hougan recibe la parte mayor. La parte enviada al Muñeco activa normalmente su efecto según los PV reales que pierda. Si el Muñeco no soporta toda su parte, el excedente no vuelve a Hougan. El efecto termina si cambia el Vínculo o el Muñeco deja de corresponder o es destruido.',
  dance:'Requiere Vínculo actual y el Muñeco correspondiente activo. En la fase de movimiento del Muñeco posterior a este turno, cada casilla que recorra hace que el Vinculado intente moverse 1 casilla en la misma dirección, sin gastar PM. Copia cada cambio de dirección. Ese movimiento activa Herida y trampas. Si un paso del Vinculado está bloqueado, ese paso simplemente falla: no hay daño de colisión y la Danza continúa.'
});

const META=Object.freeze({
  sword:['Enemigo/objeto enemigo','Alcance 1'],daggers:['Enemigo/objeto enemigo','Alcance 1'],bow:['Enemigo/objeto enemigo','Alcance 4'],spear:['Enemigo/objeto enemigo','Alcance 2'],shield:['Arfeli','Personal'],hammer:['Entidad enemiga','Alcance 3 · sin LOS'],
  rock:['Enemigo/objeto enemigo','Alcance 4 · Monolito 5'],stonearmor:['Coloso, aliado o Pilar propio','Alcance 3'],absorb:['Pilar propio','Alcance 3 + LOS'],quake:['Enemigo/objeto enemigo','Alcance 1 · o desde Pilar en Monolito'],collapse:['Pilar propio → dirección','Alcance 3 · Monolito 5'],magnetism:['Pilar propio → combatiente','Alcance 3 · Monolito 5; luego Manhattan 5'],
  precise:['Enemigo/objeto enemigo','Alcance 4'],vector:['Enemigo/objeto enemigo','Alcance 3'],impulse:['Piplus','1 o 2 casillas en línea'],interference:['Enemigo Marcado','Alcance 4'],rupture:['Enemigo Marcado','Alcance 4'],fixation:['Enemigo Marcado','Alcance 4'],
  thorn:['Enemigo/objeto enemigo','Alcance 4'],vines:['Casilla central','Alcance 3 + LOS'],sap:['Onod o aliado','Alcance 3 + LOS'],spores:['Brote propio','Cualquier Brote propio'],awakening:['Brotes propios','Personal'],reabsorption:['Todos los Brotes válidos','Personal'],
  trap_spikes:['Casilla libre','Alcance 3'],trap_mine:['Casilla libre','Alcance 3'],grenade:['Casilla','Alcance 3 + LOS'],shot:['Enemigo/objeto enemigo','Alcance 5 · misma fila/columna'],hook:['Combatiente enemigo','Alcance 3 + LOS'],hunterstep:['Destino libre','1 o 2 casillas en línea'],
  needle:['Enemigo o aliado','Alcance 4 + LOS'],transfer:['Muñeco propio','Alcance 3 + LOS'],ritual:['Enemigo Vinculado','Alcance 4 + LOS'],curse:['Enemigo','Alcance 3 · sin LOS'],paintransfer:['Hougan','Personal · requiere Vínculo + Muñeco correspondiente'],dance:['Hougan','Personal · afecta la próxima fase del Muñeco']
});

export function offlineSkillInfo(championId,id){
  const skill=catalog[championId]?.skills.find(skill=>skill.id===id);
  if(!skill)return null;
  const [target='',range='']=META[id]??['',''];
  return {
    icon:skill.icon||'✨',
    name:skill.name||id,
    cost:`${skill.cost??0} PA`,
    text:OFFLINE_SKILL_TEXT[id]??'',
    target,range
  };
}

function line(className,text){
  const node=document.createElement('span');node.className=className;node.textContent=text;return node;
}
function ensureTooltip(doc){
  let tooltip=doc.querySelector('.skill-hold-tooltip');
  if(tooltip)return tooltip;
  tooltip=doc.createElement('div');tooltip.className='skill-hold-tooltip';tooltip.setAttribute('role','tooltip');tooltip.setAttribute('aria-hidden','true');doc.body.appendChild(tooltip);return tooltip;
}
export function bindSkillHoldInfo(root,{getInfo}={}){
  if(!root)return ()=>{};
  const doc=root.ownerDocument??document;
  let timer=0,pointerId=null,startX=0,startY=0,activeButton=null,shown=false;
  const tooltip=ensureTooltip(doc);
  const hide=()=>{
    if(timer){clearTimeout(timer);timer=0}
    tooltip.classList.remove('is-visible');tooltip.setAttribute('aria-hidden','true');
    doc.documentElement.classList.remove('skill-hold-open');
    activeButton?.classList.remove('skill-hold-arming');shown=false;
  };
  const reset=()=>{hide();pointerId=null;activeButton=null;};
  const show=button=>{
    if(!button?.isConnected)return;
    const data=getInfo?.(button.dataset.skill,button);if(!data)return;
    tooltip.replaceChildren();
    const head=doc.createElement('div');head.className='skill-hold-tooltip-head';
    head.append(line('skill-hold-tooltip-icon',data.icon),line('skill-hold-tooltip-name',data.name),line('skill-hold-tooltip-cost',data.cost));
    tooltip.appendChild(head);
    if(data.text){const p=doc.createElement('p');p.className='skill-hold-tooltip-text';p.textContent=data.text;tooltip.appendChild(p);}
    if(data.target||data.range){const meta=doc.createElement('div');meta.className='skill-hold-tooltip-meta';if(data.target)meta.appendChild(line('',`🎯 ${data.target}`));if(data.range)meta.appendChild(line('',`📏 ${data.range}`));tooltip.appendChild(meta);}
    shown=true;doc.documentElement.classList.add('skill-hold-open');tooltip.classList.add('is-visible');tooltip.setAttribute('aria-hidden','false');
  };
  const down=e=>{
    const button=e.target.closest?.('[data-skill]');if(!button||!button.closest('.battle-command-panel')||e.isPrimary===false)return;
    reset();pointerId=e.pointerId;activeButton=button;startX=e.clientX;startY=e.clientY;button.classList.add('skill-hold-arming');
    timer=setTimeout(()=>{timer=0;if(pointerId===e.pointerId&&activeButton===button)show(button);},HOLD_MS);
  };
  const move=e=>{if(pointerId!==e.pointerId||!activeButton||shown)return;if(Math.hypot(e.clientX-startX,e.clientY-startY)>MOVE_TOLERANCE)reset();};
  const up=e=>{if(pointerId===e.pointerId)reset();};
  const menu=e=>{if(e.target.closest?.('[data-skill]'))e.preventDefault();};
  root.addEventListener('pointerdown',down,true);root.addEventListener('pointermove',move,true);root.addEventListener('pointerup',up,true);root.addEventListener('pointercancel',up,true);root.addEventListener('contextmenu',menu,true);
  const blur=()=>reset(),vis=()=>{if(doc.hidden)reset();};globalThis.addEventListener?.('blur',blur);doc.addEventListener('visibilitychange',vis);
  return ()=>{reset();root.removeEventListener('pointerdown',down,true);root.removeEventListener('pointermove',move,true);root.removeEventListener('pointerup',up,true);root.removeEventListener('pointercancel',up,true);root.removeEventListener('contextmenu',menu,true);globalThis.removeEventListener?.('blur',blur);doc.removeEventListener('visibilitychange',vis);};
}
