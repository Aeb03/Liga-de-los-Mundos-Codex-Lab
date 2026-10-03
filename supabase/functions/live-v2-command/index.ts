import { handler } from "../_shared/runtime.ts";
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, x-backend-expiry",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-expose-headers": "x-server-time",
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return Response.json({ error: "METHOD_NOT_ALLOWED" }, { status: 405, headers: cors });
  try {
    const raw = await req.text();
    if (raw.length > 65536) return Response.json({ error: "REQUEST_TOO_LARGE" }, { status: 413, headers: cors });
    const result = await handler({
      bearer: req.headers.get("authorization"),
      backendToken: req.headers.get("x-backend-expiry"),
      body: JSON.parse(raw),
    });
    return Response.json(result, { headers: { ...cors, "x-server-time": String(Date.now()) } });
  } catch (error) {
    const code = error instanceof Error && "code" in error ? String(error.code) : "SERVER_ERROR";
    return Response.json({ error: code }, {
      status: code === "UNAUTHENTICATED" ? 401 : code === "FORBIDDEN" ? 403 : 400,
      headers: cors,
    });
  }
});
