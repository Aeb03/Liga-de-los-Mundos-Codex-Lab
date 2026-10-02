-- Use the validated dynamic snapshot path helper when transferring authority.
-- The previous text concatenation produced malformed array literal errors.
create or replace function public.async_finish_active_unit(v jsonb)
returns text language sql immutable set search_path=public,pg_temp
as 'select public.async_snapshot_active_unit(v)';

-- Deployed Lab async_finish_turn now uses:
-- active_unit := public.async_snapshot_active_unit(p_snapshot);
