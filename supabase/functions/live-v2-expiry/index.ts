const url = Deno.env.get("SUPABASE_URL")!;
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const headers = {
  apikey: key,
  authorization: `Bearer ${key}`,
  "content-type": "application/json",
};
Deno.serve(async (req) => {
  if (
    req.headers.get("x-worker-secret") !== Deno.env.get("LIVE_V2_WORKER_SECRET")
  )
    return new Response("forbidden", { status: 403 });
  const claimed = await fetch(`${url}/rest/v1/rpc/live_v2_claim_expired`, {
    method: "POST",
    headers,
    body: JSON.stringify({ p_limit: 50 }),
  });
  if (!claimed.ok) return new Response(await claimed.text(), { status: 500 });
  const jobs = await claimed.json();
  const results = [];
  for (const job of jobs) {
    const response = await fetch(`${url}/functions/v1/live-v2-command`, {
      method: "POST",
      headers: {
        ...headers,
        "x-backend-expiry": Deno.env.get("LIVE_V2_WORKER_SECRET")!,
      },
      body: JSON.stringify({
        operation: "expire",
        args: {
          matchId: job.id,
          commandId: crypto.randomUUID(),
          expectedVersion: job.version,
          expectedTurn: job.turn_serial,
        },
      }),
    });
    results.push({ matchId: job.match_id, status: response.status });
  }
  return new Response(JSON.stringify(results), {
    headers: { "content-type": "application/json" },
  });
});
