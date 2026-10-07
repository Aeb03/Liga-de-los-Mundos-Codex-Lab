CREATE OR REPLACE FUNCTION public.live_v2_confirm_command(p_actor uuid, p_match uuid, p_command uuid, p_fingerprint text, p_expected_version bigint, p_expected_turn bigint, p_expected_phase text, p_new_phase text, p_new_turn bigint, p_new_deadline bigint, p_new_state jsonb, p_result jsonb, p_state_hash text, p_automatic boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare m live_v2.matches; c live_v2.commands; commit_ms bigint; deadline_ms bigint;
begin
  if p_automatic <> (p_actor is null) then raise exception 'INVALID_ACTOR'; end if;
  select * into m from live_v2.matches where id=p_match for update;
  if not found then raise exception 'MATCH_NOT_FOUND'; end if;
  if not p_automatic and not exists(select 1 from live_v2.members where match_id=p_match and actor_id=p_actor) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  select * into c from live_v2.commands where match_id=p_match and command_id=p_command;
  if found then
    if c.actor_id is distinct from p_actor or c.automatic<>p_automatic then
      raise exception 'FORBIDDEN' using errcode='42501';
    end if;
    if c.fingerprint<>p_fingerprint then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    if not c.accepted then raise exception '%',c.error_code; end if;
    return c.result;
  end if;
  if m.version is distinct from p_expected_version or m.phase is distinct from p_expected_phase
    or m.turn_serial is distinct from p_expected_turn then
    raise exception 'VERSION_CONFLICT';
  end if;
  if not p_automatic and m.phase='combat' and p_new_phase<>'finished' and clock_timestamp()>=m.turn_deadline then
    raise exception 'TURN_EXPIRED';
  end if;
  if p_automatic and (m.phase<>'combat' or m.turn_deadline is null or clock_timestamp()<m.turn_deadline) then
    raise exception 'NOT_EXPIRED';
  end if;
  if p_new_state->>'id' is distinct from p_match::text
    or (p_new_state->>'version')::bigint is distinct from m.version+1
    or p_new_state->>'phase' is distinct from p_new_phase
    or (p_new_state->>'turnSerial')::bigint is distinct from p_new_turn
    or p_new_turn<m.turn_serial or p_new_turn>m.turn_serial+1 then
    raise exception 'INVALID_RESULT';
  end if;
  if p_new_phase='combat' and p_new_deadline is null then raise exception 'DEADLINE_REQUIRED'; end if;
  if p_new_phase<>'combat' and p_new_deadline is not null then raise exception 'INVALID_DEADLINE'; end if;
  commit_ms=floor(extract(epoch from clock_timestamp())*1000);
  deadline_ms=p_new_deadline;
  if p_new_phase='combat' and (m.phase<>'combat' or p_new_turn>m.turn_serial) then
    deadline_ms=commit_ms+40000;
  elsif p_new_phase='combat' then
    deadline_ms=floor(extract(epoch from m.turn_deadline)*1000);
  end if;
  p_new_state=jsonb_set(p_new_state,'{turnDeadline}',coalesce(to_jsonb(deadline_ms),'null'::jsonb));
  p_result=jsonb_set(p_result,'{state,turnDeadline}',coalesce(to_jsonb(deadline_ms),'null'::jsonb));
  update live_v2.matches set state=p_new_state,phase=p_new_phase,turn_serial=p_new_turn,
    turn_deadline=case when deadline_ms is null then null else to_timestamp(deadline_ms/1000.0) end,
    version=version+1,updated_at=clock_timestamp() where id=p_match;
  insert into live_v2.commands(match_id,command_id,actor_id,automatic,fingerprint,accepted,
    expected_version,expected_turn,result,state_hash)
    values(p_match,p_command,p_actor,p_automatic,p_fingerprint,true,p_expected_version,p_expected_turn,p_result,p_state_hash);
  return p_result;
end $function$
