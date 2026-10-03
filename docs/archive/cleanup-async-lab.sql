-- Cleanup authorized exclusively for Supabase Lab szueqtkjclsumoadnien.
-- Archive verified at GitHub commit 71963295350824ec0bcfef78b502ddf9e3ebdf69.
DROP POLICY "async_matches_read" ON public.async_matches;
DROP POLICY "async_members_read" ON public.async_members;
DROP FUNCTION public.async_cached(p_request uuid, p_operation text),
public.async_create_match(p_request_id uuid),
public.async_finish_active_unit(v jsonb),
public.async_finish_turn(p_match_id uuid, p_expected_version bigint, p_expected_hash text, p_snapshot jsonb, p_request_id uuid),
public.async_hash(v jsonb),
public.async_initialize_match(p_match_id uuid, p_snapshot jsonb, p_request_id uuid),
public.async_is_member(p_match uuid),
public.async_join_match(p_room_code text, p_request_id uuid),
public.async_prepare_member(p_match_id uuid, p_champion_id text, p_loadout jsonb, p_deploy_x integer, p_deploy_y integer, p_ready boolean, p_request_id uuid),
public.async_promote_timeouts(p_match_id uuid),
public.async_snapshot_active_unit(v jsonb),
public.async_snapshot_valid(v jsonb),
public.async_start_turn(p_match_id uuid, p_expected_version bigint, p_timeout_snapshot jsonb, p_request_id uuid),
public.async_store(p_request uuid, p_operation text, p_response jsonb) RESTRICT;
DROP TABLE public.async_audit, public.async_requests, public.async_members, public.async_matches RESTRICT;
