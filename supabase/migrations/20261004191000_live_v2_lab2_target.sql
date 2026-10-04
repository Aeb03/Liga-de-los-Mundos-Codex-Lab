-- Redirect the preserved LIVE v2 expiry worker to Lab 2 without rewriting prior migrations.
create or replace function live_v2.enqueue_expiry() returns bigint
language plpgsql security definer set search_path='' as $$
declare token text;
begin
  if not exists(select 1 from live_v2.matches where phase='combat' and turn_deadline<=clock_timestamp()) then return null; end if;
  select decrypted_secret into token from vault.decrypted_secrets where name='live_v2_worker_token';
  if token is null then raise exception 'worker_token_missing'; end if;
  return net.http_post(
    url:='https://nqikacbnbwrlcofuceql.supabase.co/functions/v1/live-v2-expiry',
    headers:=jsonb_build_object('Content-Type','application/json','x-worker-secret',token),
    body:='{}'::jsonb,timeout_milliseconds:=10000
  );
end $$;
revoke execute on function live_v2.enqueue_expiry() from public,anon,authenticated;
