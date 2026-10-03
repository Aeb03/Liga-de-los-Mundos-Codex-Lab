# Lab server deployment — 2026-10-03

PR #2 integrated into online-live-v2 at 4de909876634d7513edd62020f547ee00071d893.
Destination: szueqtkjclsumoadnien only. Production was not consulted.

Applied authority schema and backend-only RPC. Added Lab scheduler migration:
pg_cron + pg_net, job live-v2-lab-expiry every 2 seconds, invoking Edge only when
there are expired matches. Credentials are generated inside PostgreSQL and
stored in Supabase Vault; no secret or service key is committed to Git.
The worker verifies its token through a service-role-only RPC. The command
endpoint verifies player sessions with Auth getUser. Gateway verify_jwt is
false because both endpoints implement these explicit authentication paths.
SDK is pinned to 2.117.2; deployment bundle includes the actual approved core.

Both functions deployed ACTIVE, version 1:
- live-v2-command
- live-v2-expiry

Remote smoke verification:
- command without session: 401 UNAUTHENTICATED;
- worker without credential: 403 FORBIDDEN;
- synthetic expired battle with zero connected clients: scheduler invoked Edge,
  JavaScript core advanced turn from 0 to 1, PostgreSQL committed version 1 and
  exactly one accepted automatic command; next turn received a fresh deadline;
- synthetic match and command removed after verification;
- Auth users remain 3; existing Auth was neither edited nor deleted;
- supabase_realtime publication was not modified.

CI of the integrated authority verified actual PostgreSQL contracts and
handler→authority→repository→SQL behavior, including retries and concurrency.
Remote smoke verifies worker transport/runtime, but does not claim a successful
player-session combat request or two-phone test. Those belong to the isolated
LIVE interface test. The offline entrypoint, resources and gameplay remain unchanged.

Supabase security advisors: LIVE private tables have RLS and no client policies
by design; privileged LIVE RPC deny anon/authenticated. Remaining notices include
pg_net extension schema placement and platform baseline Auth/cron/rls_auto_enable
notices; no unrelated platform settings were altered to silence them.
