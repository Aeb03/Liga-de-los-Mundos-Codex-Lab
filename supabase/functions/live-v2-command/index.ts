import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createEdgeHandler } from "../../../live-v2/server/edge-handler.mjs";
import { AuthoritativeService } from "../../../live-v2/server/authoritative-service.mjs";
import { SupabaseRepository } from "../../../live-v2/server/supabase-repository.mjs";
const url = Deno.env.get("SUPABASE_URL")!,
  key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const client = createClient(url, key, { auth: { persistSession: false } });
const repository = new SupabaseRepository(client);
const authority = new AuthoritativeService(repository, {
  random: () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32,
});
const handler = createEdgeHandler({
  authenticate: async (bearer) => {
    if (!bearer) return null;
    const { data } = await client.auth.getUser(
      bearer.replace(/^Bearer\s+/i, ""),
    );
    return data.user?.id ?? null;
  },
  rooms: {
    create: (actor, room) => repository.createRoom(actor, room),
    join: (actor, id, slot) => repository.joinRoom(actor, id, slot),
  },
  authority,
  backendSecret: Deno.env.get("LIVE_V2_WORKER_SECRET")!,
});
Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const result = await handler({
      bearer: req.headers.get("authorization"),
      backendToken: req.headers.get("x-backend-expiry"),
      body,
    });
    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error && "code" in error
            ? error.code
            : "SERVER_ERROR",
      },
      { status: 400 },
    );
  }
});
