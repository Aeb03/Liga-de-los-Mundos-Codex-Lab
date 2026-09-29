# Liga de los Mundos — v0.6.35-v02 — ONLINE Preparación 1v1

Estado: 🟡 LISTA PARA PROBAR — NO COMMIT / NO PUSH hasta validación.

## Alcance de este bloque
- Mantiene intacto el combate validado v0.6.34 y el online se integra como capa aislada.
- Protocolo online de prueba sube a 2 para no mezclar salas antiguas de v0.6.18.
- Equipo A crea sala; Equipo B entra por código.
- Cada dispositivo elige un campeón y exactamente 4 habilidades.
- Cada jugador confirma con `ESTOY LISTO`.
- Supabase sincroniza `champion_id`, `loadout` y `ready` mediante `online_slots` + Realtime.
- Cuando A y B están listos, ambos clientes construyen la misma preparación de Arena: Equipo A a la izquierda y Equipo B a la derecha.
- Las acciones de combate quedan BLOQUEADAS intencionalmente. Este checkpoint sólo valida conexión + selección + transición a Arena.

## Migración Supabase requerida
Ejecutar una vez `supabase-online-v0635.sql` en SQL Editor. Agrega:
- `online_slots.champion_id text`
- `online_slots.loadout jsonb`
- policy UPDATE de prueba para el MVP.

La policy es deliberadamente abierta para esta etapa experimental y deberá reemplazarse por autorización real antes de producción.

## Prueba prevista
1. Celular y PC en la misma red Wi-Fi.
2. El celular sirve los mismos archivos con `python -m http.server 8082 --bind 0.0.0.0`.
3. Celular abre `localhost:8082`; PC abre `IP_DEL_CELULAR:8082`.
4. Un dispositivo crea sala y el otro ingresa el código.
5. Ambos eligen campeón + 4 habilidades y pulsan LISTO.
6. Verificar que los dos llegan a Arena con los mismos campeones/loadouts y Equipo A/B correctos.

## No incluido todavía
- Despliegue sincronizado.
- Movimiento sincronizado.
- Habilidades sincronizadas.
- Fin de turno sincronizado.
- Hash/estado de seguridad y reconexión de combate.
