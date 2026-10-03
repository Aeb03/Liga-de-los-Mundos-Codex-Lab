# LIVE v2 — núcleo de combate aislado (etapa 1)

Este directorio es un módulo JavaScript independiente del navegador. **No está cargado por `index.html`**, no usa el estado global `B` y no integra red, salas, Supabase, UI, audio, VFX ni temporizadores.

## Ejecutar

Requiere Node.js 18 o posterior:

```sh
node --test live-v2/*.test.mjs
```

La API pública está en `combat-core.mjs`: construcción e inicialización 1v1, consulta y cálculo de movimiento, preview y confirmación exacta del recorrido, daño, cierre/inicio de turno, serialización/restauración y despacho limitado de comandos.

## Mapa de reglas extraídas

| Regla/dato | Cadena efectiva estudiada | Decisión en esta vertical |
|---|---|---|
| Tablero 12×12, BFS y desempate de vecinos `derecha, izquierda, abajo, arriba` | `app.js`: `SIZE`, `movementMap`, `gridPath` | Conservado, con obstáculos explícitos y ocupación de campeones vivos. |
| Fichas de los seis campeones | `app.js`, después sustituidas por `arfeli-rework-0626.js`, `coloso-rework-0627.js`, `piplus-rework-0628.js`, `onod-rework-0629.js`, `korgan-rework-0630.js`, `hougan-rework-0631.js` | Se conservan PV/PA/PM/Iniciativa finales de esa cadena. |
| Campos y resets base | `app.js` (`makeUnit`, `beginTurn`, `endTurnEffects`) y `balance-playtest.js` | PA/PM, penalizaciones, estados, escudo por generador y contadores comunes representados/resetados. |
| Resets por campeón | Los seis reworks y `hougan-advanced-0632.js` | Se representan los campos necesarios para restauración futura; se ejecutan los resets de inicio/fin observables aunque aún no se ejecuten habilidades. |
| Daño real y escudo | `app.js` y wrapper diagnóstico `combat-core-0625.js` | Daño normal consume escudo; daño con `ignoreShield` afecta PV. Se emiten eventos, sin presentación. |
| Hougan y daño | `hougan-damage-0632.js` | Identificado como capa de reglas de habilidades/redistribución; diferido porque esta etapa no ejecuta habilidades ni muñecos. |
| VFX/audio | `visual-effects.js`, `audio-engine-0600.js`, `audio-config-0600.js` y wrappers instalados por la cadena | Presentación únicamente; excluida del núcleo. |
| Iniciativa 1v1 | `app.js` ordenaba por iniciativa y después por id | **Diferencia aprobada:** empate mediante azar explícito; valor, candidatos y ganador quedan persistidos. |
| Placaje | `balance-playtest.js` cobraba 2 por enemigo adyacente antes de cada paso | **Diferencia aprobada:** sólo campeón enemigo vivo y sólo al romper adyacencia ortogonal; suma por campeón, ignora escudo y pre-rechaza todo el recorrido si sería mortal. |

`base-equivalence.test.mjs` obtiene los archivos directamente del commit base
`0b4983953a37fca0a60867f1007f78c67b263683` mediante `git show` y ejecuta las
definiciones finales de los seis reworks, `movementMap`, `gridPath`,
`beginTurn`, `endTurnEffects` y `applyDamage` en un contexto aislado. Compara
fichas, recorridos, Quemadura/Escudo y los resets efectivos de inicio de turno
de los seis campeones (incluidos los wrappers de balance y de cada rework) con
el núcleo nuevo. Iniciativa empatada y Placaje se excluyen de la equivalencia
porque son las dos diferencias aprobadas. Ejecución de habilidades,
invocaciones, trampas, fases del Muñeco y 2v2 no se han comparado.

`index.html` confirma el orden relevante: `app.js` → balance → seis reworks → Hougan avanzado → presentación/IA → audio → `combat-core-0625.js` → `hougan-damage-0632.js`. Por eso los reworks, y no sólo `app.js`, son la fuente de las fichas efectivas.

## Contrato y límites explícitos

- Sólo admite exactamente dos campeones, uno por equipo. `team`, `slot` y `controllerId` son campos independientes; el núcleo no autoriza comandos por controlador.
- El azar de desempate y la lectura de reloj (`clock`, sólo auditoría) son entradas. No se invocan `Math.random`, `Date.now`, temporizadores ni esperas.
- Las rutas confirmadas se validan casilla por casilla. Nunca se recalcula o sustituye silenciosamente una ruta presentada.
- Trampas, pilares, brotes, muñecos, invocaciones, ataques y habilidades producen errores tipados de “fuera de alcance”; no se simulan parcialmente.
- Herida durante desplazamiento, veneno al usar habilidades, trampas ocultas, movimientos forzados y fases del Muñeco quedan diferidos junto con la ejecución de habilidades. Mientras su daño por paso no esté implementado, cualquier estado con Herida activa se rechaza explícitamente; no se simula de forma parcial. El rechazo mortal de placaje no intenta anticipar las demás fuentes.
- Todo punto de entrada valida el estado 1v1 completo: tablero, colecciones, identidades, equipos/slots, posiciones, recursos, estados, escudos, orden, turno, ronda, fase y ganador.
- Daño y contadores son enteros: valores fraccionarios se rechazan antes de mutar. Los campos de turno usados por el núcleo también son obligatorios, evitando `NaN` y pérdidas durante el round-trip JSON.
- Los resets de campos de campeón se conservan para dar forma estable al estado, pero no se afirma equivalencia de habilidades. Tampoco se afirma equivalencia 2v2, que se rechaza.
- La muerte por daño, quemadura o placaje no ejecuta animaciones. El final se decide cuando queda un solo equipo vivo; el orden omite muertos.
