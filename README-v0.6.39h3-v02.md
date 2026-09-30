# Liga de los Mundos — v0.6.39h3-v02

Estado: EXPERIMENTAL / pendiente de validación.

Hotfix de la primera habilidad online sincronizada.

- Corrige el toque táctil sobre el objetivo de Corte con Espada en Android.
- La cámara del tablero usa `pointer capture` y `touch-action:none`; en algunos dispositivos el `click` final sobre una casilla ocupada no se emitía.
- Igual que el movimiento ya validado, un toque corto sobre una casilla `target` ejecuta la habilidad directamente en `pointerup`.
- Arrastrar sigue desplazando la cámara.
- No modifica Supabase, movimiento ni Fin de turno.
- `online_actions` sigue siendo la única fuente de sincronización de la habilidad.

Prueba: Arfeli con Corte con Espada, adyacente al rival. Tocar Corte y luego al rival. Debe aparecer una fila `ability` en `online_actions`, descontar PA y PV y verse igual en ambos clientes.
