# Liga de los Mundos — v0.6.38h5-v02

Hotfix experimental del bloque Movimiento + Fin de turno online.

- Corrige el estado visual de acción pendiente después de aplicar un movimiento sincronizado.
- Al terminar de aplicar/confirmar un movimiento, `onlineActionPending` se limpia y el HUD se vuelve a renderizar inmediatamente.
- Si quedan PM, Mover vuelve a quedar disponible.
- Fin de turno vuelve a quedar disponible siempre que el jugador conserve autoridad.
- Si PM llega a 0, sólo Mover queda deshabilitado; Fin de turno permanece habilitado.
- No cambia Supabase, reglas de movimiento, secuencia de acciones ni lógica de cambio de turno.

Estado: EXPERIMENTAL / LISTA PARA PROBAR. No hacer push hasta validación de Adrián.
