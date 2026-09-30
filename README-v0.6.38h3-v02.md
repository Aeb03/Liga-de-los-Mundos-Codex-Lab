# Liga de los Mundos v0.6.38h3-v02 — EXPERIMENTAL

Hotfix de movimiento online.

- Corrige el polling de autoridad que borraba `B.selectedAction` cada ~900 ms.
- `Mover` permanece activo mientras siga siendo el mismo turno y el cliente conserve autoridad.
- La acción se limpia sólo al cambiar de turno o autoridad.
- Mantiene h1/h2: HUD compacto, timeout automático y toque corto de casilla.
- Sin cambios de Supabase.
