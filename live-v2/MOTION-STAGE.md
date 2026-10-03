# Confirmed movement presentation

Four views reuse the effective `champion-assets.js` mapping at base 0b498395, including Coloso's upper-view exception. PNG files are unchanged. Team B initially faces the opponent. The latest accepted movement determines subsequent facing.

Authority records up to 32 accepted `unit.moved` paths in `match.presentation.moves` with their state version and unit ID. Both authenticated current members receive them through the existing snapshot projection. History is written inside the same CAS transaction as movement. Retries return the recorded result and do not append again. Deployment does not produce movement events. No migration, grants, Auth, Realtime or core rules change.

The client joins only contiguous confirmed paths that connect the previous confirmed position to the new one. Closed loops formed by successive accepted commands animate too; repeated cells within a single command remain rejected by the core. Missing/truncated history, incompatible endpoints, first load, reduced motion and reconnection fall back to the authoritative final state. Preview never starts motion. Duplicate versions never replay. New versions reconcile immediately; animation does not delay the server turn or change life/PA/PM/deadline. A rerender keeps the timeline progress; disconnect clears it. Per-step duration is 160 ms with a 900 ms total cap when several moves arrive together.

`motion-check.html` is a synthetic local-core visual fixture with a six-step route resolved as two accepted moves with an intervening turn reset and all four views; it has no room, Auth or backend traffic. `motion.html` is the separate Lab player entrypoint for two-phone verification. The previously tested `index.html` on the preview branch remains unchanged. No gameplay skills/attacks were added; HUD sizing remains provisionally approved with future compacting requested.

Tests cover exact bends, loops, combined moves, duplicate/reordered snapshots, reconnect, reduced motion, cutoff history, mapping, member visibility and idempotent backend writes. Physical two-phone animation still needs the user's test.

## Lab deployment verification — 2026-10-03
Only `live-v2-command` changed, from version 2 to ACTIVE version 3. Bundle SHA256: `83a7522c355b42ec9b24baf4d915c429091461ae20309e7a742f565db5772ab4`. Compared against the previous deployed bundle, only `authoritative-service.mjs` changed. Existing custom Auth.getUser validation, Lab URL guard, CORS clock header and backend authorization remain identical. The expiry worker remains version 1 and preserves the additive presentation field when it advances a turn.
A live unauthenticated snapshot request returned HTTP 401 `UNAUTHENTICATED`. Member visibility/idempotence and bounded history are tested; PostgreSQL integration passed in CI. No migration, database rows, Auth users, credentials, grants, cron, extensions or Realtime settings were changed for this stage. Browser fixture verified a nonzero SVG transform during motion, then no transform at final position (3,6), with the final upper-right asset. The fixture resolves two core-valid moves with a synthetic intervening turn reset and slows playback for inspection.

## Ajuste de altura del HUD

Adrián validó cuatro vistas y movimiento por casillas en ambos celulares. Se reduce principalmente el alto de la barra inferior y sólo ligeramente su ancho, en ambas orientaciones. Se mantienen avatar, PV, PA, PM, escudo, estados, cuatro habilidades y controles; no cambia el protocolo ni las reglas.
