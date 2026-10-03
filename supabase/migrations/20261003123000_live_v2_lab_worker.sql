-- Lab-only scheduler. Token is provisioned into Vault separately, never committed to Git.
create extension if not exists pg_cron;
create extension if not exists pg_net;
create function public.live_v2_authorize_worker(p_secret text)
returns boolean language sql security definer set search_path='' as $$
  select length(p_secret)>=32 and exists(
    select 1 from vault.decrypted_secrets where name='live_v2_worker_token' and decrypted_secret=p_secret
  )
$$;
revoke execute on function public.live_v2_authorize_worker(text) from public,anon,authenticated;
grant execute on function public.live_v2_authorize_worker(text) to service_role;
create function live_v2.enqueue_expiry() returns bigint
language plpgsql security definer set search_path='' as $$
declare token text;
begin
  if not exists(select 1 from live_v2.matches where phase='combat' and turn_deadline<=clock_timestamp()) then return null; end if;
  select decrypted_secret into token from vault.decrypted_secrets where name='live_v2_worker_token';
  if token is null then raise exception 'worker_token_missing'; end if;
  return net.http_post(
    url:='https://szueqtkjclsumoadnien.supabase.co/functions/v1/live-v2-expiry',
    headers:=jsonb_build_object('Content-Type','application/json','x-worker-secret',token),
    body:='{}'::jsonb,timeout_milliseconds:=10000
  );
end $$;
revoke execute on function live_v2.enqueue_expiry() from public,anon,authenticated;
select cron.schedule('live-v2-lab-expiry','2 seconds','select live_v2.enqueue_expiry();');
