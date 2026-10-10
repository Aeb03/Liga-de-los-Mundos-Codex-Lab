// One shared tutorial for the game's controls, never a champion strategy guide.
const action=id=>`[data-action="${id}"]`;
const board='.live-board';
export const tutorialSteps=[
 {id:'champion',title:'Elegí un campeón',text:'Cada campeón tiene estadísticas y seis habilidades. Tocá Coloso: lo usaremos para aprender los controles comunes.',focus:'[data-champion="coloso"]',done:c=>c.draft?.champion==='coloso'},
 {id:'skills-tab',title:'Elegí tus habilidades',text:'Abrí Habilidades. En cada partida llevás cuatro de las seis disponibles.',focus:'[data-action="preparationTab"][data-tab="skills"]',done:c=>c.preparationTab==='skills'||c.skillsVisible},
 {id:'skills',title:'Prepará cuatro habilidades',text:'Dejá seleccionadas Lanzar Roca, Armadura de Piedra, Golpe Sísmico y Colapso. Quitá Absorción Rocosa y seleccioná Colapso. Cada tarjeta muestra costo y alcance.',focus:'.prep-skills-pane input,.prep-skills-pane label',done:c=>c.draft?.skills?.length===4&&['rock','stonearmor','quake','collapse'].every(id=>c.draft.skills.includes(id))},
 {id:'ready',title:'Confirmá tu preparación',text:'Tocá Guardar y marcar listo. Cuando todos están listos comienza el despliegue.',focus:action('ready'),done:c=>c.state?.phase==='deployment'},
 {id:'deployment',title:'Elegí dónde comenzar',text:'Tocá una casilla azul de tu zona. Antes del combate podés cambiar tu posición inicial.',focus:board,done:c=>Boolean(c.state?.slots.A1.position)},
 {id:'deploy-confirm',title:'Confirmá tu posición',text:'Confirmar posición guarda la casilla elegida.',focus:action('confirmPosition'),done:c=>c.state?.slots.A1.confirmed},
 {id:'start',title:'Entrá a la arena',text:'Tocá Iniciar combate. Durante la guía el reloj queda pausado para que puedas aprender tranquilo.',focus:action('start'),done:c=>c.state?.phase==='combat'},
 {id:'round',title:'Barra de rondas',text:'Arriba ves la ronda, el reloj y el orden de turnos. La tarjeta resaltada indica quién juega. Los avatares también sirven para seleccionar campeones.',focus:'.live-round',next:true,scene:'base'},
 {id:'stats',title:'Tus recursos y habilidades',text:'Abajo ves vida, escudo, PA y PM. Las habilidades consumen PA; caminar consume PM. Podés combinar acciones mientras tengas recursos.',focus:'.live-command',next:true},
 {id:'teams',title:'Consultá los equipos',text:'Abrí Tu equipo o Rivales con la flecha. Sus tarjetas permiten consultar y seleccionar campeones sin buscarlos en el tablero.',focus:'.live-roster,[data-hud-collapse="player"],[data-hud-collapse="enemy"]',next:true},
 {id:'panel-drag',title:'Acomodá los paneles',text:'Arrastrá el tirador de puntos de Tu equipo. Podés acomodar los paneles donde te resulten cómodos.',focus:'[data-hud-panel="player"]',done:c=>Boolean(c.events.drag)},
 {id:'panel-orient',title:'Cambiá la orientación',text:'Tocá las dos flechas del panel de equipo para alternar entre horizontal y vertical.',focus:'[data-hud-orient="player"]',done:c=>Boolean(c.events.orientation)},
 {id:'panel-fold',title:'Plegá el panel',text:'Tocá la flecha de Tu equipo para plegarlo o desplegarlo. Esto libera espacio de la arena.',focus:'[data-hud-collapse="player"]',done:c=>Boolean(c.events.fold)},
 {id:'restore',title:'Restaurá la interfaz',text:'El botón de flecha circular en la barra de rondas devuelve los paneles a su posición original.',focus:action('resetHud'),done:c=>Boolean(c.events.restore)},
 {id:'rotate',title:'Girá la vista',text:'Tocá una flecha curva para ver la arena desde otro lado. Girar la cámara no cambia las casillas ni consume recursos.',focus:`${action('rotateCameraLeft')},${action('rotateCameraRight')}`,done:c=>Boolean(c.events.rotate)},
 {id:'pan',title:'Desplazá la arena',text:'Arrastrá una zona libre de la arena con un dedo o con el mouse. Esto mueve la vista, no al campeón.',focus:'.arena-stage',done:c=>Boolean(c.events.pan)},
 {id:'zoom',title:'Acercá y alejá',text:'Usá dos dedos para acercar o alejar la arena. En PC usá la rueda del mouse. El zoom tiene límites para conservar una vista útil.',focus:'.arena-stage',done:c=>Boolean(c.events.zoom)},
 {id:'move-button',title:'Prepará un movimiento',text:'Tocá Mover. Las casillas azules muestran los destinos disponibles según tus PM y los obstáculos.',focus:action('moveMode'),scene:'base',done:c=>c.movementArmed},
 {id:'move-target',title:'Elegí el destino',text:'Tocá una casilla azul. El recorrido marcado muestra por dónde caminarás y cuántos PM cuesta.',focus:board,done:c=>Boolean(c.preview)},
 {id:'move-confirm',title:'Confirmá el movimiento',text:'Tocá otra vez el destino, o Mover para confirmar. Elegir una casilla todavía no gasta PM: confirmar sí.',focus:`${board},${action('moveMode')}`,done:c=>c.own?.pm<3},
 {id:'rock',title:'Prepará una habilidad',text:'Tocá Lanzar Roca. Su tarjeta muestra que cuesta 3 PA; las casillas resaltadas indican su alcance.',focus:action('rock'),scene:'base',done:c=>c.selection?.abilityId==='rock'},
 {id:'enemy',title:'Seleccioná un objetivo',text:'Tocá al rival en el tablero o su avatar en la barra de turnos. Podés seleccionar campeones e invocaciones según la habilidad.',focus:`${board},.turn-order [data-inspect-id="B1"]`,done:c=>c.selection?.targetId==='B1'},
 {id:'attack',title:'Confirmá la habilidad',text:'Tocá otra vez al rival o Lanzar Roca. Ahora se ejecuta el ataque: bajan los PA y la vida del objetivo.',focus:`${board},${action('rock')},.turn-order [data-inspect-id="B1"]`,done:c=>c.enemy?.hp<c.enemy?.maxHp},
 {id:'vision',title:'Alcance y línea de visión',text:'Esta columna bloquea la visión hacia el rival. Estar cerca no siempre alcanza: algunas habilidades necesitan una línea libre y otras la ignoran. Los objetivos válidos se resaltan al elegir una habilidad.',focus:`${board},${action('rock')}`,scene:'vision',next:true},
 {id:'native',title:'Acciones nativas',text:'Las acciones propias del campeón están debajo de sus estadísticas. Tocá Pilar: cuesta 1 PA y se coloca eligiendo una casilla.',focus:action('createPillar'),scene:'base',done:c=>c.selection?.abilityId==='createPillar'},
 {id:'native-position',title:'Objetivo de tipo casilla',text:'Tocá una casilla azul libre para colocar el Pilar. No todas las habilidades seleccionan un campeón: algunas seleccionan una posición.',focus:board,done:c=>Boolean(c.selection?.position)},
 {id:'native-confirm',title:'Confirmá la invocación',text:'Tocá otra vez la casilla o Pilar. Aparece la invocación y se descuenta su costo.',focus:`${board},${action('createPillar')}`,done:c=>c.state?.combat.objects.some(o=>o.alive&&o.type==='pillar')},
 {id:'area-button',title:'Habilidades de área',text:'Tocá Colapso. Prepararemos un Pilar de un turno anterior para aprender a orientar un área.',focus:action('collapse'),scene:'area',done:c=>c.selection?.abilityId==='collapse'},
 {id:'area-object',title:'Seleccioná la invocación',text:'Tocá el Pilar. Esta habilidad empieza seleccionando una invocación propia, no al rival.',focus:board,done:c=>Boolean(c.selection?.targetId)},
 {id:'area-direction',title:'Orientá el área',text:'Arrastrá desde una casilla al costado del Pilar hasta la casilla del rival y soltá. Las casillas magenta muestran qué posiciones recibirán el efecto. Todavía no se ejecuta.',focus:board,done:c=>Boolean(c.events.areaOriented&&c.selection?.direction&&c.selection?.aoe?.locked)},
 {id:'area-confirm',title:'Confirmá el área',text:'Revisá las casillas magenta y tocá Colapso para ejecutar. Seleccionar, orientar y confirmar son pasos distintos.',focus:action('collapse'),done:c=>c.enemy?.hp<c.enemy?.maxHp},
 {id:'self',title:'Seleccioná un aliado o a vos',text:'Tocá Armadura de Piedra y después tu campeón, en la arena o en la barra de turnos. Algunas habilidades se usan sobre aliados o sobre uno mismo.',focus:`${action('stonearmor')},${board},.turn-order [data-inspect-id="A1"]`,scene:'base',done:c=>c.selection?.abilityId==='stonearmor'&&c.selection?.targetId==='A1'},
 {id:'self-confirm',title:'Confirmá la protección',text:'Tocá nuevamente tu campeón o Armadura de Piedra para obtener escudo.',focus:`${action('stonearmor')},${board},.turn-order [data-inspect-id="A1"]`,done:c=>c.own?.shield.some(s=>s.amount>0)},
 {id:'states',title:'Dónde aparecen los estados',text:'Debajo de cada avatar en el orden de turnos aparecen los estados y su cantidad. Estos son ejemplos de Herida, Veneno y Quemadura. Seleccioná un campeón para consultar sus datos.',focus:'.turn-order',scene:'states',next:true},
 {id:'end',title:'Terminá tu turno',text:'Tocá Terminar turno cuando no quieras seguir actuando. El turno pasa al siguiente campeón; en tu próximo turno se renuevan PA y PM.',focus:action('end'),scene:'base',done:c=>c.state?.combat.order[c.state.combat.turnIndex]!=='A1'},
 {id:'clock',title:'El tiempo de turno',text:'Ahora el reloj corre: observá esta cuenta de 10 segundos. Al llegar a cero termina el turno automáticamente. En una partida real tenés el tiempo completo.',focus:'.live-round',scene:'clock',done:c=>c.state?.turnSerial>c.clockSerial},
 {id:'finish',title:'Tutorial completado',text:'Ya conocés la preparación, la interfaz y los controles generales. Podés probar una partida normal. Como invitado, la demo no guarda resultados.',focus:'',finish:true}
];
export function tutorialAllows(target,step){
 if(target?.closest?.('.tutorial-card,.tutorial-options,.liga-options-lobby,.liga-options-battle,.liga-audio-options-backdrop'))return true;
 return Boolean(step?.focus&&target?.closest?.(step.focus));
}
export function mountTutorial({context,scene,finish}){
 let index=0,active=false,pending=false,sceneId=null,clockSerial=0;
 const events={};let lastCamera={x:0,y:0,zoom:1},paintKey=null;let root=document.createElement('div');root.id='tutorial-overlay';root.hidden=true;document.body.append(root);
 function start(){index=0;active=true;pending=false;sceneId=null;clockSerial=0;Object.keys(events).forEach(k=>delete events[k]);update();}
 function stop(){active=false;paintKey=null;root.hidden=true;root.replaceChildren();document.body.classList.remove('tutorial-active');}
 function note(kind){if(active){events[kind]=true;update();}}
 function update(){
  if(!active)return;const c={...context(),events,clockSerial};if(tutorialSteps[index].id==='pan'&&(c.camera.x!==lastCamera.x||c.camera.y!==lastCamera.y))events.pan=true;if(tutorialSteps[index].id==='zoom'&&c.camera.zoom!==lastCamera.zoom)events.zoom=true;lastCamera={...c.camera};if(!c.state){stop();return;}
  let step=tutorialSteps[index];
  if(!pending&&(!step.scene||sceneId===step.id)&&step.done?.(c)){index++;step=tutorialSteps[index];}
  if(step.scene&&sceneId!==step.id&&!pending){pending=true;sceneId=step.id;paint(step);Promise.resolve(scene(step.scene)).then(()=>{clockSerial=context().state?.turnSerial??0;pending=false;update();}).catch(()=>{pending=false;sceneId=null;paint(step,'No pudimos preparar este paso. Tocá Reintentar.');});return;}
  paint(step);
 }
 function paint(step,error=''){
  document.body.classList.add('tutorial-active');root.hidden=false;
  const key=`${index}:${pending}:${error}`;
  if(paintKey===key){requestAnimationFrame(()=>highlight(step));return;}
  paintKey=key;
  root.innerHTML=`<svg class="tutorial-shade" width="100%" height="100%" aria-hidden="true"><defs><mask id="tutorial-holes"><rect width="100%" height="100%" fill="white"/></mask></defs><rect width="100%" height="100%" fill="#020812" fill-opacity=".84" mask="url(#tutorial-holes)"/></svg><button class="tutorial-options" type="button" aria-label="Opciones">⚙ Opciones</button><section class="tutorial-card" role="region" aria-label="Guía del tutorial" aria-live="polite"><small>TUTORIAL · ${index+1}/${tutorialSteps.length}${step.id==='clock'?'':' · RELOJ PAUSADO'}</small><strong>${step.title}</strong><p>${error||step.text}</p>${error?'<button data-tutorial-next>Reintentar</button>':pending?'<span>Preparando…</span>':step.next?'<button data-tutorial-next>Entendido · Continuar</button>':step.finish?'<button data-tutorial-finish>Volver al lobby</button>':'<span>Completá la acción resaltada para continuar.</span>'}</section>`;
  root.querySelector('.tutorial-options').onclick=()=>window.LigaAudioOptions?.open();
  root.querySelector('[data-tutorial-next]')?.addEventListener('click',()=>{if(error){update();return;}index++;update();});
  root.querySelector('[data-tutorial-finish]')?.addEventListener('click',()=>finish());
  requestAnimationFrame(()=>highlight(step));
 }
 function highlight(step){
  const mask=root.querySelector('#tutorial-holes');if(!mask)return;
  while(mask.children.length>1)mask.lastElementChild.remove();
  const selector=[step.focus,'.tutorial-options','.liga-options-battle','.liga-options-lobby','.liga-audio-options-backdrop'].filter(Boolean).join(',');
  const boxes=[...document.querySelectorAll(selector)].filter(el=>!el.closest('#tutorial-overlay')||el.matches('.tutorial-options')).map(el=>el.getBoundingClientRect()).filter(r=>r.width&&r.height);
  for(const r of boxes){const hole=document.createElementNS('http://www.w3.org/2000/svg','rect');for(const [k,v] of Object.entries({x:r.left-3,y:r.top-3,width:r.width+6,height:r.height+6,rx:5,fill:'black'}))hole.setAttribute(k,v);mask.append(hole);}
  const card=root.querySelector('.tutorial-card');if(!card)return;
  const focusBoxes=step.focus?[...document.querySelectorAll(step.focus)].map(el=>el.getBoundingClientRect()).filter(r=>r.width&&r.height):[];
  // Place instructions opposite the actionable UI, while keeping both visible.
  card.classList.toggle('tutorial-card-top',focusBoxes.some(r=>r.top>innerHeight*.55));
 }
 function gate(e){
  if(!active)return;const target=e.target instanceof Element?e.target:e.target?.parentElement;
  const prepScroll=['champion','skills-tab','skills','ready'].includes(tutorialSteps[index].id)&&['pointerdown','wheel'].includes(e.type)&&target?.closest('.prep-editor,.prep-grid')&&!target.closest('button,input,label');
  if(prepScroll)return;
  if(pending&&!target?.closest('.tutorial-options,.liga-audio-options-backdrop,.liga-options-battle,.liga-options-lobby,.tutorial-card')||!tutorialAllows(target,tutorialSteps[index])){e.preventDefault();e.stopImmediatePropagation();return;}
  if(e.type==='click'&&target?.closest('[data-hud-orient]'))events.orientation=true;
  if(e.type==='click'&&target?.closest('[data-hud-collapse]'))events.fold=true;
  if(e.type==='click'&&target?.closest('[data-action="resetHud"]'))events.restore=true;
  if(e.type==='click'&&target?.closest('[data-action="rotateCameraLeft"],[data-action="rotateCameraRight"]'))events.rotate=true;
  if(e.type==='click'||e.type==='change'||e.type==='pointerup'||e.type==='wheel')setTimeout(update,80);
 }
 for(const type of ['pointerdown','click','change','keydown','wheel'])document.addEventListener(type,gate,{capture:true,passive:false});
 document.addEventListener('pointerup',()=>{if(active&&['pan','zoom','panel-drag','area-direction'].includes(tutorialSteps[index].id))setTimeout(update,120);},true);
 window.addEventListener('liga-tutorial-exit',()=>{if(active)finish();});
 window.addEventListener('resize',()=>{if(active)paint(tutorialSteps[index]);});
 return {start,stop,update,note,get active(){return active;},get step(){return tutorialSteps[index]?.id;}};
}
