# Liga de los Mundos — v0.6.38h4-v02 EXPERIMENTAL

Hotfix de sincronización de Movimiento online.

- Movimiento y Fin de turno solamente; habilidades siguen bloqueadas.
- Procesamiento idempotente por `online_actions.seq`.
- Si Realtime/polling vuelven a entregar el mismo movimiento, no se ejecuta dos veces ni dispara una falsa desincronización.
- Si una acción ya dejó a la unidad en `to` con el `pmAfter` esperado, se reconoce como aplicada.
- No requiere migración Supabase adicional.
- No validar ni hacer push hasta prueba real en dos dispositivos.
