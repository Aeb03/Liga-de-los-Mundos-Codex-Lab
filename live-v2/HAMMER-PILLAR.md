# Martillo y Pilar — LIVE v2 Lab

Entrega apilada sobre Lanza/Sísmico; no fusionar. Los archivos del offline, assets, esquema SQL, Auth, Cron y Realtime no cambian.

## Reglas efectivas

Fuente fijada a `0b4983953a37fca0a60867f1007f78c67b263683`: `arfeli-rework-0626.js` (`hammerLandingCandidates`, `hammerJump`, ejecución de `hammer`) y `coloso-rework-0627.js` (creación y límites de Pilar).

- Martillo: 4 PA, Manhattan 3 sin LOS, objetivo enemigo (campeón o Pilar); 13 daño + Maestría. No es área. Aterriza cardinalmente junto al objetivo en casilla libre: menor distancia a Arfeli, desempate y/x. Si ya está junto al objetivo, golpea desde su casilla.
- El salto ignora obstáculos intermedios, conserva PM y no cobra placaje. La Herida normal se cobra por distancia lógica al aterrizaje; el escudo absorbe. Si mata a Arfeli, no golpea ni aplica penalización. Veneno puede cancelarlo antes de saltar.
- Campeón objetivo vivo y móvil pierde 1 PM al comienzo de su próximo turno; Pilar no recibe esa penalización. No se acumula por repetición (máximo 1).
- Pilar: objeto separado de campeón, equipo, slot y controlador; 15 PV, bloquea casilla y LOS; máximo 2 activos, una creación a 0 PA al abrir el turno de Coloso, alcance Manhattan 5 con LOS. Movimiento o habilidad cierra la oportunidad. No ocupa uno de los cuatro espacios de habilidad.
- Los ataques ya habilitados pueden dañar Pilares enemigos; Herida, penalización y desplazamiento forzado se limitan a campeones. Destrucción conserva el objeto muerto para auditoría, libera la casilla y no decide ganador. El placaje sólo cuenta campeones.

Fusión, Reciclaje, Monolito, proyección y Réplicas siguen diferidos. Trampas, Brotes e invocaciones se rechazan. No se afirma equivalencia de esas mecánicas.

## Presentación y autoridad

Primer toque muestra objetivo y aterrizaje, segundo confirma. Crear Pilar sigue el mismo patrón y pasa por un comando `createPillar` con identidad, turno, deadline, CAS e idempotencia existentes. El servidor publica el salto con `kind: jump` y sólo sus dos extremos; la animación traza un arco visual, sin inventar casillas pisadas ni modificar el estado confirmado. La acción propia de Coloso aparece encima del HUD para conservar su tamaño aprobado.

Estado antiguo sin `nextPillarId` sigue siendo restaurable; la primera creación deriva una secuencia segura. El formato permanece 1v1; los objetos no se añaden al orden de turnos.

## Verificación

`node --test live-v2/*.test.mjs live-v2/server/*.test.mjs live-v2/client/*.test.mjs`

Pruebas de creación/capacidad/LOS/ocupación/serialización, daño/destrucción sin fin de combate, aterrizajes comparados con función efectiva offline, Herida/escudo/muerte/cancelación, penalización PM, animación y servicio autoritativo con reintentos. CI añade los contratos PostgreSQL. `hammer-check.html`: Coloso crea Pilar en (4,5), termina turno; Arfeli usa Martillo sobre Coloso (6,5), aterriza (5,5) pasando el Pilar; Coloso queda 102 PV, y empezará con 2 PM. Prueba física de dos celulares pendiente.
