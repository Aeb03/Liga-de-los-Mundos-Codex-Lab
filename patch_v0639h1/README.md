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


## v0.6.39h1-v02
Hotfix experimental: reconciliación determinista del daño de Corte con Espada entre ambos clientes. Sin migración adicional.
