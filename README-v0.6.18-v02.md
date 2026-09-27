# Liga de los Mundos — v0.6.18-v02 — ONLINE MVP 1

Estado: 🟡 LISTA PARA CONFIGURAR Y PROBAR

Primera capa online experimental, aislada del motor de combate.

- Nueva entrada `1v1 ONLINE (PRUEBA)`.
- Crear sala: `online_matches` con `team_size=1`, `protocol_version=1`, creador en Equipo A / Slot 1.
- Unirse: segundo jugador en Equipo B / Slot 1.
- Supabase Realtime observa cambios de `online_slots` y actualiza ambos celulares.
- No inicia combate ni modifica el 1v1/2v2 vs IA.
- `player_id` temporal persistente en LocalStorage (`liga-online-player-id-v1`).
- Al abandonar: se cierra WebSocket/heartbeat, se elimina el slot propio; si queda alguien, la sala vuelve a `waiting`; si queda vacía, se elimina la partida.
- Configuración pública en `online-config.js`: SOLO Project URL + Publishable key.
- Workflow APK actualizado para usar los iconos oficiales existentes como launcher/adaptive icon Android.

Nunca colocar service_role, secret key ni contraseña PostgreSQL en el cliente.
