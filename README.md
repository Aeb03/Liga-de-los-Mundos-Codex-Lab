# Liga de los Mundos — v0.6.38h2-v02 — Movimiento + Fin de turno online

Estado: 🟡 LISTA PARA PROBAR — NO COMMIT / NO PUSH hasta validación de Adrián.

Base: checkpoint estable v0.6.37-v02 + v0.6.38-v02 experimental.

## Este hotfix corrige
- La tarjeta de autoridad online deja de tapar Arena/controles y se integra de forma compacta al HUD inferior.
- Durante TU TURNO quedan visibles Mover y Fin de turno en la columna habitual.
- Durante TURNO RIVAL esos controles aparecen bloqueados y el cliente permanece observador.
- Al llegar el temporizador compartido a 0 s, sólo el controlador activo solicita automáticamente Fin de turno.
- `turn_seq` mantiene la protección contra doble avance de turno.

## Se conserva de v0.6.38
- Movimiento normal sincronizado por comandos.
- Descuento de PM reproducido en ambos clientes.
- Fin de turno manual sincronizado.
- Cambio de activo, ronda y temporizador compartidos.
- Registro en `public.online_actions`.
- Realtime + polling REST de respaldo.
- Detección de desincronización.

## Sigue bloqueado
- Todas las habilidades online.
- Acciones especiales de campeón.
- Reconexión/replay completo y checksum de estado.

## Supabase
No requiere migración nueva si `supabase-online-v0638.sql` ya fue ejecutado.

No se modifica `online-config.js` y el ZIP no lo incluye.


## v0.6.39-v02 — online habilidad simple
Primera habilidad online sincronizada: Arfeli — Corte con Espada. Movimiento y Fin de turno validados se mantienen. Requiere `supabase-online-v0639.sql`.


## v0.6.39h2-v02
Hotfix experimental: reconciliación determinista del daño de Corte con Espada entre ambos clientes. Sin migración adicional.


## v0.6.39h3-v02
Hotfix táctil: Corte con Espada online se ejecuta en `pointerup` sobre la casilla objetivo, igual que Mover, para evitar que Android pierda el click por la cámara. Sin migración adicional.


## v0.6.40-v02
Amplía habilidades online básicas: Arfeli (Corte, Disparo con Arco, Portación de Escudo) y Piplus (Flecha de Precisión). Sin migración Supabase nueva.

## v0.6.40h1-v02
Hotfix visual del HUD online: botones de habilidad compactos (icono + coste PA + contador de usos), sin nombre largo visible. La descripción completa se mantiene por pulsación larga ~1,5 s también en botones online. Sin cambios de lógica ni Supabase.

## v0.6.41-v02
Amplía el canal `ability` online con Arfeli — Dagas Danzantes (daño + Herida 2), Onod — Savia Vital (curación) y Korgan — Disparo de Caza. Mantiene las habilidades básicas ya validadas, sin migración Supabase nueva.


## Experimental — online asíncrono
La rama de laboratorio incorpora un modo 1v1 asíncrono persistente, separado del online LIVE existente.
La arquitectura, flujo de prueba, migraciones y limitaciones están documentados en `docs/ONLINE-ASYNC.md`.
No aplicar las migraciones fuera del proyecto Supabase Lab.
