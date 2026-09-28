# Liga de los Mundos — v0.6.21-v02 — Hotfix de arranque

🧪 EXPERIMENTAL.

Corrige un fallo introducido al preparar el Bloque 2A: se había omitido accidentalmente
el bloque base de infraestructura situado entre BOT_LOADOUTS y makeUnit.

Se restauran:
- FIXED_OBS y zonas de despliegue.
- setup, B y timerId.
- perfil local y guardado.
- helpers base (sleep, key, geometría isométrica, cámara).
- helpers champ/ability/randomChampionExcluding.

Validación:
- node --check app.js: OK
- smoke test de arranque: OK; showStart vuelve a renderizar.

No cambia las nuevas fichas ni las mecánicas 2A–2D.
