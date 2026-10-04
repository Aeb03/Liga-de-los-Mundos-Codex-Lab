# Arfeli y Coloso — bloque completo de reglas

Esta etapa añade Arco de Arfeli y Armadura, Absorción, Colapso, Magnetismo, Fusión, Salir y Reciclaje de Coloso. Completa Sísmico proyectado y Réplicas en Monolito. Conserva las seis habilidades efectivas por campeón y la selección de cuatro para cada combate. Acciones propias de Coloso fuera del loadout.

## Fuentes y decisiones

Fuente congelada: `0b4983953a37fca0a60867f1007f78c67b263683`, `arfeli-rework-0626.js`, `coloso-rework-0627.js`, `balance-playtest.js` y `app.js` para `leaveMonolith`. Los valores actuales proceden de esos reworks, no de fichas antiguas.

- Arco: 3 PA, MD4, LOS, 8 + Maestría. Misma cadena/reset y veneno que otras habilidades de Arfeli.
- Armadura: 2 PA, 10 escudo, MD3 + LOS (autoobjetivo válido), aliados/Pilar propio, máximo 2 usos y uno por objetivo. Escudo en campeones y Pilares expira al próximo inicio del generador.
- Absorción: 2 PA, Pilar propio antiguo a MD3 + LOS, cura hasta 15 PV reales, consume el Pilar aun con menos PV. Rechaza salud completa y Pilar creado en el mismo turno.
- Fusión: acción propia 3 PA, Pilar propio adyacente8, consume, guarda PM y entra en Monolito sin escudo extra. Salir: 0 PA, restaura PM guardados y no permite otra Fusión ese turno.
- Monolito permite hasta 3 Pilares, Roca MD5 y Colapso/Magnetismo MD5. Salir conserva los tres Pilares existentes, pero no permite crear otro mientras se supere el límite normal de dos.
- Reciclaje: 0 PA, sólo Monolito, una vez/turno. Consume Pilar propio y repara al restante con menos PV (desempate por número); si no queda uno dañado, escudo6 al dueño.
- Colapso: 3 PA, Pilar propio MD3/5 + LOS; selección de Pilar y dirección cardinal. Cono exactamente como offline: cercana offsets −1/0/1, media −1/+1, lejana0. Daño max(3,PV−6/−3/0), PV reales del Pilar, sólo enemigos. Consumo después de veneno y validación completa.
- Magnetismo: 3 PA, Pilar propio MD3/5 + LOS; segundo objetivo combatiente a MD5 del Pilar, sin LOS secundaria. Atracción2 con dirección fija, Herida por paso real y colisión2 por paso restante (mitad al bloqueador). Puede atraer al dueño móvil, pero no al dueño en Monolito.
- Sísmico: origen Coloso si adyacente8 (10), o primer Pilar por número en Monolito (8). Empuje1, colisión4/2. Sólo en Monolito, Réplicas6 desde Pilares ortogonales sucesivos, cada Pilar una vez; no reutiliza el origen. Sin inventar área cruz.

Todos los comandos mantienen autorización del slot activo, versión, turno, plazo, selección, idempotencia y recuperación. `colosoAction` es un nuevo tipo bajo esos mismos controles. Dirección y segundo objetivo forman parte del fingerprint. Sin cambios SQL/Auth/Realtime.

## Cliente

Todos los ataques conservan alcance/LOS/efecto. Colapso: tocar Pilar, tocar dirección, repetir dirección para confirmar. Magnetismo: tocar Pilar, tocar combatiente, repetir combatiente para confirmar. MOVER cancela; cambio de versión/turno cancela selección. Acciones de Monolito agrupadas bajo Dominio Rocoso; sprites originales de Monolito. No animación de caminata nueva.

## Verificación

`node --test live-v2/*.test.mjs live-v2/client/*.test.mjs live-v2/server/*.test.mjs`

111 PASS locales, dos PostgreSQL se ejecutan en CI. Incluye 15 casos nuevos de reglas y 2 de autoridad; geometría de Colapso comparada con ejecución de la función del offline congelado. Pruebas de daño, escudo, consumo, máximo de vida, restricciones, muerte por veneno/Herida, cap, resets, Réplicas, rechazos atómicos, idempotencia y snapshots de ambos miembros.

`champions-check.html` es un fixture sin red para inspeccionar HUD, Monolito y áreas; no demuestra por sí mismo latencia ni controles físicos en dos celulares. Esa prueba queda para Adrián.

Offline, peanas, texturas existentes, arena, audio, cámara y otros campeones no se modifican. PR apilado sobre #13, sin fusionar. Sólo Supabase Lab `szueqtkjclsumoadnien` puede recibir este bundle.
