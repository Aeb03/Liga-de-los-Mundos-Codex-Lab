# Primera habilidad LIVE v2: Corte con Espada

Base: PR 6, commit 37c1cc27045da9b3df76f01df6b6fcfac4452d3d. El tamaño de HUD, vistas y movimiento animado fueron aprobados por Adrián en ambos celulares.

## Regla efectiva

Fuente: `arfeli-rework-0626.js` cargado por la base offline. Corte cuesta 2 PA, tiene alcance Manhattan 1, hace 10 daño normal y admite dos usos por turno. Maestría con Armas suma la longitud de la cadena de habilidades distintas; repetir Corte reinicia la cadena sin bonus. Moverse no la rompe. El inicio/fin de turno conserva los resets existentes. Veneno cobra daño normal al usar la habilidad después de gastar PA; si mata a Arfeli no se ejecuta el golpe. Escudos absorben daño normal. El daño mortal resuelve muerte y ganador. Maldición activa se rechaza por estar fuera del alcance.

## Autoridad y cliente

Comando `ability`: `id`, `matchId`, `expectedVersion`, `expectedTurn`, `slotId`, `abilityId: sword`, `targetId`. El cliente no envía daño, coste o resultado. El servidor valida miembro, controlador del slot activo, fase, turno, deadline y que Corte esté entre las cuatro habilidades elegidas. El núcleo valida campeón, recursos, usos y objetivo enemigo vivo ortogonalmente adyacente. Reutiliza el CAS y la idempotencia por actor existentes. Un reintento devuelve el resultado confirmado sin volver a cobrar PA/daño. Sin mutaciones parciales en rechazos.

En `motion.html`: tocar Corte marca los objetivos válidos. Primer toque al enemigo presenta daño nominal y coste; segundo toque al mismo enemigo envía el comando. MOVER cancela el modo habilidad. Cambios de versión/turno, desconexión y finalización cancelan la selección. Los PV, PA y contador de usos sólo reflejan estado confirmado. Otros botones siguen deshabilitados.

## Validación

`node --test live-v2/*.test.mjs live-v2/server/*.test.mjs live-v2/client/*.test.mjs`: 58 PASS, 2 comprobaciones PostgreSQL omitidas localmente; CI ejecuta estas últimas. Pruebas cubren escudo, límite/reset, rechazo atómico, alcance/diagonal, Maestría, veneno mortal, muerte/ganador, loadout, controlador, versiones, deadline e idempotencia. `sword-check.html` permite comprobar los dos toques y recursos con el núcleo real, sin Auth ni sala.

No se editan archivos offline, texturas ni tablas. El servidor y el cliente sólo pertenecen al Lab `szueqtkjclsumoadnien`. Sin cambios de Auth, RLS, cron ni Realtime. La prueba real en dos celulares sigue pendiente hasta que Adrián confirme.
