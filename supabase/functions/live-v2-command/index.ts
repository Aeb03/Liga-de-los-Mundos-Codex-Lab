const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      "content-type": "application/json",
      ...init.headers,
    },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.message ?? "Supabase request failed");
  return body;
}
Deno.serve(async (req) => {
  try {
    const bearer = req.headers.get("authorization");
    if (!bearer) return json({ error: "UNAUTHENTICATED" }, 401);
    const user = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: serviceKey, authorization: bearer },
    });
    if (!user.ok) return json({ error: "UNAUTHENTICATED" }, 401);
    const actor = (await user.json()).id;
    const input = await req.json();
    const procedures: Record<string, string> = {
      create: "live_v2_create_room",
      join: "live_v2_join_room",
      snapshot: "live_v2_snapshot",
      recover: "live_v2_recover_command",
      command: "live_v2_prepare_command",
    };
    const procedure = procedures[input.operation];
    if (!procedure) return json({ error: "INVALID_OPERATION" }, 400);
    return json(
      await request(`/rest/v1/rpc/${procedure}`, {
        method: "POST",
        body: JSON.stringify({ p_actor: actor, ...input.args }),
      }),
    );
  } catch (error) {
    return json(
      {
        error: "SERVER_ERROR",
        message: error instanceof Error ? error.message : "unknown",
      },
      500,
    );
  }
});
