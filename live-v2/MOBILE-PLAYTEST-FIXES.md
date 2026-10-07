# Four-phone playtest fixes — 2026-10-07

Adrián and friends connected and played with four real phones. This validates connectivity, not this new patch.

- Move button arms movement; a tile previews the route; the same button confirms.
- Ability button selects the action; a target previews it; the same ability confirms. Hook distance controls only choose distance.
- Area gestures preview and lock the area without executing it.
- Camera captures a pointer only once dragging starts, so a normal tap reaches the tile.
- Notices appear at the top and ignore pointer events.
- Allies use blue markers regardless of controller identity.
- Same-team duplicate champion selection is rejected by the authority and disabled in the picker. Opposing teams may choose the same champion.
- Each champion turn lasts 40 seconds, measured from database commit.
- In 2v2, teammates sort by initiative and teams alternate. Starting team uses its leading champion's initiative. Ties draw once at initialization; the resulting order is shared.
- Dead champions do not occupy tiles during state validation.
- A member can abandon after the clock expires; the database still checks membership and version.

Verification: 222 available automated tests pass; 2 local Postgres integration tests are skipped. Historical offline equivalence tests and MP3 asset existence tests cannot run in the source-only workspace (no historical Git objects or binary assets). The five directly affected suites also pass, 58 tests. New patch still needs four-phone touch validation.
