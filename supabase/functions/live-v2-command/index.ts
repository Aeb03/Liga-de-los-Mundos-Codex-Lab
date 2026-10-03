// Deployment adapter skeleton. Identity must come from the verified Authorization session.
// Compute with live-v2/server/authoritative-service.mjs, then call live_v2.confirm_command;
// the SQL function rechecks version/turn under row lock. Never return SERVICE_ROLE_KEY.
Deno.serve(() => new Response(JSON.stringify({error:'NOT_DEPLOYED'}),{status:501,headers:{'content-type':'application/json'}}));
