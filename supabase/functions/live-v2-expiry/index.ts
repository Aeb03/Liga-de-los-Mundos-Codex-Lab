import { authority, repository, authorizeWorker } from "../_shared/runtime.ts";
Deno.serve(async (req) => {
  if (req.method !== "POST") return Response.json({ error: "METHOD_NOT_ALLOWED" }, { status: 405 });
  if (!await authorizeWorker(req.headers.get("x-worker-secret"))) {
    return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  try {
    const jobs = await repository.expired(50);
    const results = [];
    for (const job of jobs) {
      try {
        const result = await authority.command("backend", {
          id: job.command_id, matchId: job.match_id, type: "expireTurn",
          expectedVersion: job.expected_version, expectedTurn: job.expected_turn,
        });
        results.push({ matchId: job.match_id, accepted: true, version: result.version });
      } catch (error) {
        results.push({ matchId: job.match_id, accepted: false,
          error: error instanceof Error && "code" in error ? String(error.code) : "SERVER_ERROR" });
      }
    }
    return Response.json({ results });
  } catch {
    return Response.json({ error: "WORKER_ERROR" }, { status: 500 });
  }
});
