-- Fix dynamic JSON path used to determine authority after an async timeout.
create or replace function public.async_snapshot_active_unit(v jsonb)
returns text language sql immutable set search_path=public,pg_temp
as 'select v #>> array[''battle'',''order'',coalesce(v #>> ''{battle,turn}'',''0'')]';

-- async_promote_timeouts in the deployed Lab now calls
-- public.async_snapshot_active_unit(m.timeout_snapshot)
-- instead of constructing a malformed text path.
