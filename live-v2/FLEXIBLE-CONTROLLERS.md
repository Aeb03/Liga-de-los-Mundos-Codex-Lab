# LIVE v2 — flexible controllers, 2026-10-07

2v2 creation assigns A1/A2/B1/B2 to shared same-team human controllers, independent invited humans, or AI. A1 is the creator. Opposing teams can never share a human controller. AI champion selection happens during creation; AI uses four server-defined skills, prepares and deploys automatically. Human champions retain independent selection, deployment, resources, and turns.

The participant-authenticated snapshot endpoint advances at most one server-planned AI action. Optimistic version checking ensures concurrent polls cannot duplicate actions. The planner evaluates legal skills and routes through the existing combat engine and excludes hidden enemy traps from its planning input. AI progresses while a participant is connected; the existing expiry worker handles elapsed turns. This is a basic tactical AI for flexible rooms, not the separate proposed Expert profile system.

Publication: development and live-v2-preview updated. motion.html uses v=20261007-flex1 and includes the earlier mobile touch/notice/team-ring changes. Command Edge Function deployed; flexible room and join RPCs active in LAB2. Legacy formats remain supported server-side.

Validation: 250 passing automated tests, 2 PostgreSQL-local tests skipped. Database transactions verified shared controller membership and three-human/one-AI rooms; rolled back afterwards. Real authenticated API smoke created one human plus three AI, selected/deployed/started combat, confirmed 11 AI actions and turn advancement, then confirmed abandonment. Browser verified the published creation page and per-seat controller/bot champion selectors.

Pending: user phone playtest of flexible controller combinations and the previously published touch confirmations, team rings, notices, 40-second alternating turns, duplicate prevention, and abandonment. No phone validation claimed for this patch.
