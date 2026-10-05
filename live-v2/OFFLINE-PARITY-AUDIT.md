# Auditoría de paridad Offline → LIVE v2

Fecha: 2026-10-05  
Fuente offline congelada inspeccionada: `0b4983953a37fca0a60867f1007f78c67b263683`  
Checkpoint LIVE v2 de partida: `checkpoint/live-v2-hougan-complete-20261005` / `c5f5b9b23c099bf8bbf7721409fda9838beddd60`

## Criterio

Esta auditoría no rediseña funciones. El offline es la fuente de verdad para presentación, interacción, audio y comportamiento ya existente. Cuando una capa base antigua fue reemplazada por un rework posterior, manda la capa final cargada por `index.html`.

Estados usados:

- ✅ PARIDAD / ya existe en LIVE v2.
- 🟡 PARCIAL / existe pero difiere del offline o falta prueba real.
- ❌ FALTA / el offline lo tiene y LIVE v2 no.
- ⏸ 2v2 / no puede validarse realmente en el 1v1 actual.

## 1. Motor de combate

### Campeones y autoridad

- ✅ Los seis campeones actuales están incorporados al core autoritativo de LIVE v2.
- ✅ Hougan base + Transferencia de Dolor + Danza Vudú: 184/184 tests automáticos PASS en el checkpoint final y validación real en celulares.
- ✅ Piplus, Onod y Korgan tienen validación real reciente.
- 🟡 Arfeli y Coloso conservan cobertura automática, pero conviene una pasada real final antes de declarar cerrado el 1v1.
- ⏸ La parte support de Hougan sólo puede validarse realmente con aliado en 2v2. La lógica queda cubierta automáticamente en 1v1.
- ✅ El Muñeco tiene fase propia de 3 PM, movimiento divisible y animación confirmada por servidor.

### Ciclo de partida

- ✅ El comando `abandon` termina autoritativamente la partida, anula `turnDeadline` y evita que `expireTurn` continúe avanzándola.
- 🟡 Falta prueba real específica posterior al fix: abandonar y confirmar que después del vencimiento no cambia de ronda.
- ❌ Cerrar pestaña/app sin pulsar **Abandonar** todavía no equivale a abandono autoritativo. No hay presencia/TTL de inactividad que cierre una partida sin ambos clientes. Esto es distinto del botón Abandonar y debe resolverse antes de considerar completo el ciclo de vida.
- ✅ Temporizador y autoridad de turno están sincronizados en servidor.
- ✅ Privacidad de trampas de Korgan: el rival no recibe las trampas ocultas en su vista pública.

## 2. Arena, cámara y fondo

Fuente offline: `app.js`, `arena-central.js`, `arena-central.css`.

- ✅ LIVE v2 ya usa `arena-central-base.png` y `arena-central-background.png`.
- ✅ La cuadrícula funcional 12×12 está alineada sobre la plataforma.
- ✅ Los obstáculos usan arte de arena `arena-block.png`.
- ❌ Falta arrastrar la arena/cámara con el dedo.
- ❌ Falta el clamp de cámara del offline.
- ❌ Faltan los botones de cámara ↶ / ↷ para giro de 90°.
- ❌ Falta recentrar sobre la unidad seleccionada/activa al girar.
- ❌ Falta recalcular la vista visual de miniaturas/objetos con el giro de cámara.
- ❌ Falta el parallax del Coliseo que acompaña el paneo. Valores extraídos del offline:
  - X: 0.22 del movimiento de cámara, máximo ±56 px.
  - Y: 0.14 del movimiento de cámara, máximo ±20 px.
  - el fondo acompaña el desplazamiento pero no rota físicamente.

## 3. HUD y ventanas

Fuente offline: `app.js`, `hud-horizontal-only.js`, `hud-lock-0548.js` y CSS de HUD.

Offline posee módulos separados: Ronda/Orden, cámara, TU EQUIPO, RIVALES y panel inferior de combate.

- 🟡 LIVE v2 reutiliza varias texturas 9-slice y la disposición general, pero no reproduce los controles de ventana.
- ❌ Falta arrastrar las ventanas mediante el asa **⠿**.
- ❌ Falta guardar las posiciones normalizadas en `localStorage`.
- ❌ Falta plegar/desplegar cada panel, no sólo la ventana inferior.
- ❌ Falta cambio horizontal/vertical en las ventanas laterales.
- ✅ En el offline, Ronda y panel inferior están forzados a horizontal por las capas finales `hud-horizontal-only.js` + `hud-lock-0548.js`; no se debe reintroducir orientación vertical para esos dos paneles.
- ❌ Falta botón **↺ Restablecer HUD**.
- ❌ Falta la ventana móvil de controles de cámara.
- ❌ Falta el panel **📜 Registro** plegable con las últimas 8 entradas del combate.

## 4. Inspección de combatientes y panel inferior

Fuente offline: `app.js::renderBattle`.

- ❌ En offline se puede tocar un combatiente o invocación, o su entrada de roster, para inspeccionarlo. LIVE v2 muestra principalmente al campeón activo.
- ❌ Falta que la tarjeta inferior cambie al combatiente/objeto inspeccionado.
- Offline muestra en esa tarjeta:
  - PV actuales/máximos;
  - Escudo;
  - PA y PM;
  - estados en chips;
  - para objetos, PV/Escudo y descripción propia;
  - para el Muñeco durante su fase, PM restantes.
- 🟡 LIVE v2 posee parte de esa información, pero no el flujo exacto de inspección.

## 5. Estados visuales y barra de vida

Fuente offline: `statusText`, `statusChips`, `statusIcons`, `renderEntity`, más wrappers finales de campeones.

### Sobre la miniatura

Offline coloca, de arriba hacia abajo:

1. estados compactos;
2. barra separada de Escudo `🛡️N` cuando existe;
3. texto PV;
4. barra de PV;
5. miniatura.

Los indicadores base extraídos son:
- Herida: `🩸N`
- Veneno: `☠️N`
- penalización PA: `🔨-1PA`
- penalización PM: `🌿-NPM`
- Maldición: `☠️`
- Marcado: `🎯`
- Vinculado: `🪡`
- Monolito: `🗿`

Quemadura sí existe en `statusText/statusChips` y su activación tiene feedback propio; la función base `statusIcons` inspeccionada no la dibuja arriba, por lo que no se debe inventar un icono superior distinto sin otra capa final que lo haga.

- 🟡 LIVE v2 muestra los estados como una línea de texto sobre la vida. La información existe, pero la presentación NO coincide.
- 🟡 LIVE v2 mezcla Escudo en texto/recursos en lugar de la barra compacta separada exacta del offline.

### Panel inferior

Offline usa chips explícitos:
- `🩸 Herida N`
- `☠️ Veneno N`
- `🔥 Quemadura N`
- penalizaciones de PA/PM
- Marcado, Vinculado, Monolito, Berserker
- Hougan avanzado añade `🩸 Dolor 50/50` y `🪆 Danza preparada`.

- ❌ LIVE v2 todavía no reproduce ese sistema de chips tal cual.

## 6. Habilidades: barra, cajón y pulsación larga

Fuentes offline: `app.js`, `skill-hold-info.js`, `skill-hold-info.css`, más `actionInfo` final de cada rework.

### Flujo de controles

Offline normal:
- **Mover**
- **Habilidades**
- **Fin turno**
- el botón Habilidades abre/cierra un **skill drawer** con las cuatro elegidas.

- 🟡 LIVE v2 muestra permanentemente las cuatro habilidades. Funciona, pero no coincide con la interacción offline.
- ❌ Falta el cajón de habilidades exacto.

### Pulsación larga

Reglas exactas:
- `HOLD_MS = 1500`.
- tolerancia de movimiento `14 px`.
- sólo puntero primario.
- se cancela si el dedo se desplaza más de la tolerancia.
- se cierra en pointerup/pointercancel/blur/visibility hidden.
- se bloquea el menú contextual del navegador sobre habilidades.
- la tarjeta muestra icono, nombre, coste, texto, objetivo y alcance.
- usa el `actionInfo(id)` FINAL de la cadena de reworks; no un texto reconstruido.

- ❌ LIVE v2 sólo tiene `title` corto. No tiene la tarjeta por pulsación larga.

Para portarla, los textos deben salir de las definiciones/reworks del offline. No se escribirán descripciones nuevas manualmente.

## 7. Preview táctico y áreas

Fuente offline: `combat-core-0625.js` + CSS.

- ✅ LIVE v2 ya dibuja alcance, objetivos, efecto y desplazamientos forzados para muchas habilidades.
- 🟡 No es idéntico al sistema táctil final del offline.
- ❌ Falta el preview AoE táctil global: amarillo = alcance; magenta = área real; arrastrar mueve el área; soltar la fija; segundo toque al centro ejecuta.
- ❌ Falta el estado visual “área fijada” y su ayuda contextual exacta.

## 8. Audio SFX

Fuentes offline: `audio-config-0600.js`, `audio-engine-0600.js`.

- ❌ LIVE v2 no tiene motor de audio conectado.
- El offline usa WebAudio con buses:
  - MASTER
  - MUSIC
  - SFX_COMBAT
  - SFX_UI
- desbloquea audio con el primer gesto real;
- precarga los SFX;
- deduplica sonidos;
- limita superposición de sonidos fuertes;
- reproduce curación, Escudo, ruptura de Escudo y KO según resultado real, no por predicción.
- Regla crítica de privacidad: las trampas de Korgan NO suenan al colocarse; suenan al activarse para no revelar su tipo al rival.

Archivos específicos ya presentes en el pack para Arfeli, Coloso, Piplus, Onod, Korgan y Hougan deben reutilizarse. La tabla antigua del motor contiene algunos IDs previos a los reworks (`marker`, `pillar`, `reflected`, `doll`); al portar a LIVE v2 se debe enlazar el MISMO evento semántico a su archivo aprobado, no copiar ciegamente IDs obsoletos ni inventar sonidos.

## 9. Música

Fuente offline: `music-engine-0633.js`.

- ❌ LIVE v2 no reproduce música.
- Lobby:
  - `assets/audio/music/lobby-liga.mp3?v=0633`
  - loop start 0.52 s
  - loop end 169.30 s
- Arena:
  - `assets/audio/music/arena-central-combate.mp3?v=0633`
  - loop start 0.36 s
  - loop end 156.88 s
- fade: 650 ms.
- duck por defecto: 0.58.
- el motor pausa al ocultar/salir y recupera pausas inesperadas.
- resultado = sin música.
- primer gesto desbloquea el audio.

## 10. Opciones

Fuentes offline: `audio-options-0601.js`, `audio-options-0601.css`.

- ❌ Falta botón **⚙️ Opciones**.
- ❌ Falta panel modal de audio.
- storage exacto: `liga-audio-settings-v1`.
- defaults:
  - master 1.00
  - music 0.40
  - sfx 0.92
  - muted false
- controles:
  - **Volumen del juego** — Volumen general
  - **Música ambiente** — Lobby y Arenas
  - **Sonidos del juego** — Golpes, habilidades, escudos y estados
  - botón Mute.
- offline inserta Opciones en lobby y un botón compacto de engranaje en combate.

## 11. VFX y feedback

Fuente offline: `visual-effects.js`.

- ❌ LIVE v2 no tiene la capa completa de VFX del offline.
- El offline trata VFX como observador; no decide mecánicas.
- Incluye:
  - números flotantes de daño/curación/Escudo;
  - impacto;
  - proyectil;
  - Escudo y ruptura;
  - área;
  - estado aplicado y activado;
  - flecha de desplazamiento forzado;
  - spawn/vanish;
  - transferencia;
  - activación de trampa;
  - Marca/Vínculo;
  - transformación;
  - pulso de activación;
  - KO.
- 🟡 LIVE v2 ya tiene ruta visual de movimiento y flechas de desplazamiento, pero no esta capa completa de feedback.

## 12. Arte táctico específico

- ✅ Las cuatro vistas de campeones y la excepción de Coloso para vistas superiores están contempladas por `spriteSource`.
- ✅ Monolito tiene sprite táctico.
- ✅ Las trampas rivales permanecen invisibles y las propias son visibles.
- ⚠️ Muñeco de Hougan: el offline final `hougan-visual-0631.js` decide por `linkMode`:
  - aliado → `muneco-houngan-01`
  - enemigo → `muneco-houngan-02`
- ❌ LIVE v2 actualmente usa `muneco-houngan-01` para ambos casos, incluso durante la animación. Debe corregirse.

## 13. Resultado de combate

Fuente offline: `showResult(win)`.

- ❌ LIVE v2 termina mostrando el estado final dentro de la arena.
- Offline posee pantalla de resultado con:
  - Victoria / Derrota;
  - estado de equipo azul y rojo con PV/KO;
  - modo;
  - ronda final;
  - Revancha;
  - Cambiar equipo;
  - Volver al Lobby.
- En LIVE v2 las acciones posteriores deberán adaptarse a una sala online autoritativa; la presentación puede extraerse del offline, pero no se debe inventar una “revancha online” sin protocolo de servidor. Se implementará primero la pantalla y se definirá la acción online sólo si existe soporte equivalente.

## 14. Lobby, selección y despliegue

- ✅ LIVE v2 ya tiene Crear/Unirse, selección de campeón + cuatro habilidades, Listo/No listo y despliegue sincronizado.
- 🟡 La función está, pero la presentación es la del Lab, no la interfaz offline final.
- 🟡 El offline tiene selección/lobby más desarrollados y un despliegue visual integrado a la misma arena isométrica.
- Antes de 2v2 se debe portar lo que pertenezca al flujo de partida online sin arrastrar pantallas ajenas al match.
- No se reemplazará la autoridad LIVE v2 por el viejo backend de `online-lobby.js`; ese archivo sirve sólo como referencia de UI/flujo, no como arquitectura de red.

## 15. PWA / caché / orientación

- ✅ La app principal offline posee PWA y política de actualización segura fuera del combate.
- 🟡 La preview LIVE v2 es una superficie de Lab y no reproduce toda la envoltura PWA de la app principal.
- La integración final debe reutilizar la infraestructura PWA existente; no crear un segundo sistema de Service Worker para LIVE v2.
- La orientación horizontal fija y el mensaje de rotación deben conservar el criterio de la app principal al integrar LIVE v2.

## 16. Orden de implementación propuesto sin inventar diseño

1. **Paridad visual crítica del combate**
   - Muñeco 01/02 correcto.
   - estados/escudo sobre PV.
   - chips y tarjeta de inspección.
   - tocar roster/unidad para inspeccionar.
2. **HUD + cámara**
   - arrastre, plegado, orientación donde corresponda, reset.
   - paneo de arena, giro y parallax del fondo.
3. **Interacción de habilidades**
   - Mover/Habilidades/Fin turno + drawer.
   - pulsación larga 1.5 s usando actionInfo extraído.
   - preview AoE táctil final.
4. **Audio**
   - SFX aprobado.
   - música lobby/arena.
   - Opciones y persistencia.
5. **Feedback**
   - VFX.
   - Registro.
   - resultado.
6. **Ciclo de vida**
   - prueba real de Abandonar.
   - resolver cierre/inactividad cuando se cierra la app sin Abandonar.
7. **Cierre 1v1**
   - regresión completa automática;
   - Arfeli/Coloso prueba real;
   - pasada real de UI/audio en dos celulares.
8. **Checkpoint “LIVE v2 1v1 parity”**.
9. Recién entonces iniciar **2v2**, incluyendo prueba real del support de Hougan.

## Conclusión

El motor de combate autoritativo está mucho más adelantado que la capa de experiencia. El mayor faltante antes de 2v2 no es una nueva mecánica de campeón: es trasladar al LIVE v2 la experiencia del offline ya existente —HUD, cámara, estados, skill info, audio, música, opciones, VFX, inspección y cierre visual— sin cambiar la autoridad de red ni inventar reglas nuevas.
