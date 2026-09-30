# Liga de los Mundos — v0.6.38-v02 EXPERIMENTAL

Bloque online incremental sobre el checkpoint v0.6.37-v02.

## Alcance
- Movimiento normal online sincronizado por comandos.
- Fin de turno online sincronizado con control optimista de `turn_seq`.
- Un solo controlador puede emitir acciones durante su autoridad.
- El rival permanece como observador y reproduce el movimiento recibido.
- PM se descuentan en ambos clientes mediante el mismo motor de movimiento local.
- El siguiente campeón activo recupera sus recursos de turno al cambiar `turn_seq`.
- Habilidades continúan bloqueadas intencionalmente.
- El temporizador sigue sin finalizar el turno automáticamente al llegar a 0 en este bloque.

## Arquitectura
Se agrega `public.online_actions` como registro de comandos. Cada acción conserva secuencia de servidor, match, turno, actor, tipo, payload y resultado. Esto evita transmitir el tablero completo y deja una base para recuperación/replay posterior.

## Supabase
Ejecutar una sola vez `supabase-online-v0638.sql` antes de probar.

Estado: 🟡 LISTA PARA PROBAR. No hacer push hasta validación de Adrián.
