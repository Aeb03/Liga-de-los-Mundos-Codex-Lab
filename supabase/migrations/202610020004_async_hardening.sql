alter function public.async_hash(jsonb) set search_path=public,pg_temp;
alter function public.async_snapshot_valid(jsonb) set search_path=public,pg_temp;
revoke all on function public.async_cached(uuid,text) from anon,authenticated;
revoke all on function public.async_store(uuid,text,jsonb) from anon,authenticated;
revoke all on function public.async_is_member(uuid) from anon,authenticated;
create index if not exists async_audit_match_idx on public.async_audit(match_id);
