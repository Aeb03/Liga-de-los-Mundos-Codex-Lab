import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.2";
import { createEdgeHandler } from "../../../live-v2/server/edge-handler.mjs";
import { AuthoritativeService } from "../../../live-v2/server/authoritative-service.mjs";
import { SupabaseRepository } from "../../../live-v2/server/supabase-repository.mjs";
const url = Deno.env.get("SUPABASE_URL")!;
if (url !== "https://nqikacbnbwrlcofuceql.supabase.co") throw new Error("LAB_ONLY");
const client = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
export const repository = new SupabaseRepository(client);
export const authority = new AuthoritativeService(repository, {
  random: () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32,
});
export async function authorizeWorker(token: string | null) {
  if (!token || token.length < 32 || token.length > 256) return false;
  const { data, error } = await client.rpc("live_v2_authorize_worker", { p_secret: token });
  return !error && data === true;
}
export const handler = createEdgeHandler({
  authenticate: async (bearer: string | null) => {
    if (!bearer) return null;
    const { data, error } = await client.auth.getUser(bearer.replace(/^Bearer\s+/i, ""));
    return error ? null : data.user?.id ?? null;
  },
  rooms: {
    create: (actor: string, room: { id: string }) => repository.createRoom(actor, room),
    join: (actor: string, id: string, slot: string) => repository.joinRoom(actor, id, slot),
  },
  authority,
  authenticateBackend: authorizeWorker,
});
