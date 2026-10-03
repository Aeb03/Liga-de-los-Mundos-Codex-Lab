# Confirmed movement presentation

Four views reuse the effective `champion-assets.js` mapping at base 0b498395, including Coloso's upper-view exception. PNG files are unchanged. Team B initially faces the opponent. The latest accepted movement determines subsequent facing.

Authority records up to 32 accepted `unit.moved` paths in `match.presentation.moves` with their state version and unit ID. Both authenticated current members receive them through the existing snapshot projection. History is written inside the same CAS transaction as movement. Retries return the recorded result and do not append again. Deployment does not produce movement events. No migration, grants, Auth, Realtime or core rules change.

The client joins only contiguous confirmed paths that connect the previous confirmed position to the new one. Closed loops animate too. Missing/truncated history, incompatible endpoints, first load, reduced motion and reconnection fall back to the authoritative final state. Preview never starts motion. Duplicate versions never replay. New versions reconcile immediately; animation does not delay the server turn or change life/PA/PM/deadline. A rerender keeps the timeline progress; disconnect clears it. Per-step duration is 160 ms with a 900 ms total cap when several moves arrive together.

`motion-check.html` is a synthetic local-core visual fixture with a four-step square and all four views; it has no room, Auth or backend traffic. `motion.html` is the separate Lab player entrypoint for two-phone verification. The previously tested `index.html` on the preview branch remains unchanged. No gameplay skills/attacks were added; HUD sizing remains provisionally approved with future compacting requested.

Tests cover exact bends, loops, combined moves, duplicate/reordered snapshots, reconnect, reduced motion, cutoff history, mapping, member visibility and idempotent backend writes. Physical two-phone animation still needs the user's test.
