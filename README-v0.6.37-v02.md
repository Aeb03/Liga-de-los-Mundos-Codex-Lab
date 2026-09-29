# Liga de los Mundos — v0.6.37-v02 — Autoridad de turno online

Estado: 🧪 EXPERIMENTAL / 🟡 LISTA PARA PROBAR — NO COMMIT / NO PUSH hasta validación de Adrián.

## Base
Parte del checkpoint estable v0.6.36-v02, con despliegue online sincronizado ya validado en dos celulares.

## Alcance de este bloque
- Conserva todo el flujo validado de sala, selección y despliegue.
- Tras confirmar ambos despliegues, Equipo A inicializa un único estado de autoridad en `online_matches`.
- Ambos clientes leen el mismo `round_number`, `turn_index`, `turn_seq`, `active_team`, `active_slot` y `turn_started_at`.
- El orden se calcula de forma determinista con Iniciativa, equipo y slot como desempates estables.
- El cliente que controla la unidad activa muestra `TU TURNO · AUTORIDAD ACTIVA`.
- El otro cliente muestra `TURNO RIVAL · MODO OBSERVADOR`.
- Los dos muestran la misma unidad activa, la misma Ronda 1, el mismo orden y un temporizador de 30 s basado en el mismo instante de inicio.
- Se usa la cabecera `Date` de Supabase para compensar diferencias de reloj entre dispositivos.
- Al llegar a 0 s el reloj queda en 0: este bloque NO avanza el turno todavía.
- Movimiento, Habilidades y Fin de turno continúan bloqueados intencionalmente.

## Arquitectura
La autoridad se identifica por `team + slot`, no por colores visuales ni por un supuesto rígido Jugador A/Jugador B. La unidad conserva además `controller` y `playerId`, por lo que la comprobación local de autoridad corresponde al controlador real de la unidad activa.

La migración admite slots 1–5 por equipo para no cerrar el camino a futuros equipos de hasta 5v5. No implementa esos modos todavía.

## Migración Supabase requerida
Ejecutar una vez `supabase-online-v0637.sql` en SQL Editor. Agrega a `online_matches`:
- `round_number`
- `turn_index`
- `turn_seq`
- `active_team`
- `active_slot`
- `turn_started_at`

No toca las columnas de despliegue ya validadas, Project URL, Publishable Key, RLS ni Realtime.

## Prueba prevista en 2 dispositivos
1. Ejecutar `supabase-online-v0637.sql` una sola vez.
2. Instalar el ZIP encima del checkpoint actual, sin borrar la carpeta.
3. Crear sala y unirse desde el segundo celular.
4. Seleccionar campeón + 4 habilidades y confirmar LISTO en ambos.
5. Desplegar y confirmar en ambos como en v0.6.36.
6. Verificar que ambos pasan a Ronda 1.
7. Verificar que ambos muestran el MISMO campeón activo y el MISMO orden.
8. En el celular dueño de la unidad activa debe decir `TU TURNO · AUTORIDAD ACTIVA`.
9. En el otro debe decir `TURNO RIVAL · MODO OBSERVADOR`.
10. Comparar el temporizador: ambos deben bajar prácticamente juntos hasta 0 s.
11. Confirmar que en ninguno aparecen botones funcionales de Movimiento, Habilidades o Fin de turno.

## No incluido todavía
- Cambio real al siguiente turno.
- Movimiento online.
- Fin de turno online.
- Habilidades online.
- Tabla/stream de comandos online.
- Reconexión, checksum y recuperación de desincronización.
