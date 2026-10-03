# Dagas Danzantes y Herida

Base: PR 8, 55245bef5660b3103b6096200393828f528ed677. Sólo Lab szueqtkjclsumoadnien. Offline, cámara, audio y texturas no cambian. Escudo y Roca continúan pendientes de prueba física con dos celulares.

Fuente efectiva fijada: 0b4983953a37fca0a60867f1007f78c67b263683, arfeli-rework-0626.js (ficha y resolución de Dagas), app.js (addStatus/applyWoundStep/halveStatusEndTurn) y balance-playtest.js (moveUnit/woundTravelStep).

Dagas: 3 PA, alcance ortogonal 1, 10 daño normal, máximo un uso por turno. Maestría suma al daño; Herida 2 se añade después del daño sólo si el objetivo sigue vivo, con máximo acumulado 3. Veneno mortal al pagar cancela el efecto. Reutiliza comando ability, validación de controlador/slot/loadout/turno/versión/deadline y CAS/idempotencia.

Herida: daño normal por cada casilla realmente recorrida; el escudo absorbe. El placaje aprobado se paga antes de abandonar adyacencia e ignora escudo; Herida se paga después de entrar a la casilla. El estado se divide por dos, hacia abajo, al terminar el turno de su portador, manual o por expiración. Muerto por Herida: se detiene en la casilla mortal, consume únicamente PM recorridos y resuelve ganador. El evento unit.moved contiene sólo el tramo realizado, que el servidor persiste para presentación. Sin recálculo de caminos.

El preview es puro y conserva el recorrido seleccionado: muestra daño de Herida, PV finales y aviso de muerte durante el recorrido. Se conserva la diferencia aprobada de rechazar previamente recorridos mortales por placaje solo. No se extiende ese veto a Herida: conserva la resolución offline de muerte durante movimiento. Trampas, movimientos forzados e invocaciones siguen fuera de alcance.

Dagas utiliza la selección de objetivos y el segundo toque existentes; no se añade botón de confirmación. Recursos, Herida y usos son valores confirmados. daggers-check.html es una demostración local del núcleo real, sin Auth o sala, con controles para Dagas, turnos y movimiento.

Pruebas: coste/límite/objetivos/rechazo atómico, Maestría, máximo de Herida, escudo, veneno mortal, muerte del objetivo, recorridos sucesivos, PM, muerte parcial, serialización, funciones offline fijadas, sincronización para ambos miembros, idempotencia y expiración automática. Ambos bundles Edge deben incluir este mismo núcleo: el worker antiguo rechaza Herida activa.

Despliegue previsto: primero worker de expiración compatible, luego live-v2-command y frontend live-v2-preview. Autenticación y secretos existentes se conservan; sin SQL, migraciones, permisos, usuarios, Realtime o infraestructura nuevos.
