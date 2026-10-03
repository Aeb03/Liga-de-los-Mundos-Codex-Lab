-- Review only. Future destination: Lab szueqtkjclsumoadnien. Never applied remotely by this PR.
create schema live_v2;
create table live_v2.matches (
  id uuid primary key,
  creator_id uuid not null,
  version bigint not null default 0 check (version >= 0),
  phase text not null check (phase in ('preparation','deployment','combat','finished')),
  turn_serial bigint not null default 0 check (turn_serial >= 0),
  turn_deadline timestamptz,
  state jsonb not null,
  updated_at timestamptz not null default clock_timestamp()
);
create table live_v2.members (
  match_id uuid not null references live_v2.matches on delete cascade,
  actor_id uuid not null,
  slot_id text not null,
  team text not null check (team in ('A','B')),
  slot smallint not null check (slot between 1 and 3),
  primary key (match_id,slot_id), unique (match_id,team,slot),
  check (slot_id = team || slot::text)
);
create table live_v2.commands (
  match_id uuid not null references live_v2.matches on delete cascade,
  command_id uuid not null,
  actor_id uuid,
  automatic boolean not null default false,
  fingerprint text not null,
  accepted boolean not null,
  expected_version bigint not null,
  expected_turn bigint,
  result jsonb not null,
  error_code text,
  server_time timestamptz not null default clock_timestamp(),
  state_hash text,
  primary key (match_id,command_id),
  check ((automatic and actor_id is null) or (not automatic and actor_id is not null))
);
create index members_actor_match on live_v2.members(actor_id,match_id);
create index matches_expiry on live_v2.matches(turn_deadline) where phase='combat';
alter table live_v2.matches enable row level security;
alter table live_v2.members enable row level security;
alter table live_v2.commands enable row level security;

-- Internal projection. Diagnostics stay in backend storage; deployment positions are private.
create function live_v2.project_state(p_state jsonb,p_actor uuid)
returns jsonb language sql immutable set search_path='' as $$
  select (case when p_state->>'phase'='deployment' then
    jsonb_set(p_state,'{slots}',(
      select jsonb_object_agg(k,case when v->>'controllerId'=p_actor::text then v
        else jsonb_set(jsonb_set(v,'{position}','null'),'{controllerId}','null') end)
      from jsonb_each(p_state->'slots') e(k,v)
    )) else p_state end) - 'diagnostics'
$$;

create function public.live_v2_create_room(p_actor uuid,p_match uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s jsonb;
begin
  if p_actor is null or p_match is null then raise exception 'INVALID_ROOM'; end if;
  s=jsonb_build_object(
    'id',p_match,'creatorId',p_actor,'phase','preparation','version',0,
    'turnSerial',0,'turnDeadline',null,'combat',null,'result',null,
    'createdAt',floor(extract(epoch from clock_timestamp())*1000),
    'diagnostics',jsonb_build_array(),
    'slots',jsonb_build_object(
      'A1',jsonb_build_object('id','A1','team','A','slot',1,'controllerId',p_actor,
        'championId',null,'skills',jsonb_build_array(),'ready',false,'position',null,'confirmed',false),
      'B1',jsonb_build_object('id','B1','team','B','slot',1,'controllerId',null,
        'championId',null,'skills',jsonb_build_array(),'ready',false,'position',null,'confirmed',false)));
  insert into live_v2.matches(id,creator_id,phase,state) values(p_match,p_actor,'preparation',s);
  insert into live_v2.members values(p_match,p_actor,'A1','A',1);
  return live_v2.project_state(s,p_actor);
end $$;

create function public.live_v2_join_room(p_actor uuid,p_match uuid,p_slot text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare m live_v2.matches;
begin
  if p_actor is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into m from live_v2.matches where id=p_match for update;
  if not found then raise exception 'MATCH_NOT_FOUND'; end if;
  if m.phase<>'preparation' then raise exception 'JOIN_CLOSED'; end if;
  if p_slot is distinct from 'B1' then raise exception 'SLOT_UNAVAILABLE'; end if;
  if exists(select 1 from live_v2.members where match_id=p_match and slot_id=p_slot) then
    if exists(select 1 from live_v2.members where match_id=p_match and slot_id=p_slot and actor_id=p_actor) then
      return live_v2.project_state(m.state,p_actor); -- reconnect/retry does not reassign
    end if;
    raise exception 'SLOT_TAKEN';
  end if;
  insert into live_v2.members values(p_match,p_actor,'B1','B',1);
  m.state=jsonb_set(jsonb_set(m.state,'{slots,B1,controllerId}',to_jsonb(p_actor)),
    '{version}',to_jsonb(m.version+1));
  update live_v2.matches set state=m.state,version=version+1,updated_at=clock_timestamp() where id=p_match;
  return live_v2.project_state(m.state,p_actor);
end $$;

create function public.live_v2_snapshot(p_actor uuid,p_match uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s jsonb;
begin
  if not exists(select 1 from live_v2.members where match_id=p_match and actor_id=p_actor) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  select state into s from live_v2.matches where id=p_match;
  return live_v2.project_state(s,p_actor);
end $$;
create function public.live_v2_backend_match(p_match uuid)
returns jsonb language sql security definer set search_path='' as $$
  select state from live_v2.matches where id=p_match
$$;

create function public.live_v2_prepare_command(
  p_actor uuid,p_match uuid,p_command uuid,p_fingerprint text,p_automatic boolean default false
) returns jsonb language plpgsql security definer set search_path='' as $$
declare c live_v2.commands; m live_v2.matches;
begin
  if p_automatic <> (p_actor is null) then raise exception 'INVALID_ACTOR'; end if;
  select * into m from live_v2.matches where id=p_match;
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
    return jsonb_build_object('status',case when c.accepted then 'confirmed' else 'rejected' end,
      'result',c.result,'error_code',c.error_code);
  end if;
  return jsonb_build_object('status','new','match',m.state);
end $$;

-- CAS + command log commit together. The Edge backend supplies a calculated result, never the client.
-- Deadlines in the wire protocol are integer milliseconds. PostgreSQL stores timestamptz internally.
create function public.live_v2_confirm_command(
  p_actor uuid,p_match uuid,p_command uuid,p_fingerprint text,
  p_expected_version bigint,p_expected_turn bigint,p_expected_phase text,
  p_new_phase text,p_new_turn bigint,p_new_deadline bigint,
  p_new_state jsonb,p_result jsonb,p_state_hash text,p_automatic boolean default false
) returns jsonb language plpgsql security definer set search_path='' as $$
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
    raise exception 'VERSION_CONFLICT' using errcode='40001';
  end if;
  if not p_automatic and m.phase='combat' and clock_timestamp()>=m.turn_deadline then
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
    deadline_ms=commit_ms+30000;
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
end $$;

-- Called in a separate transaction after a failed calculation/CAS. Never overwrites an accepted command.
create function public.live_v2_reject_command(
  p_actor uuid,p_match uuid,p_command uuid,p_fingerprint text,
  p_expected_version bigint,p_expected_turn bigint,p_error_code text,p_automatic boolean default false
) returns jsonb language plpgsql security definer set search_path='' as $$
declare m live_v2.matches; c live_v2.commands; r jsonb;
begin
  if p_automatic <> (p_actor is null) then raise exception 'INVALID_ACTOR'; end if;
  select * into m from live_v2.matches where id=p_match for update;
  if not found then raise exception 'MATCH_NOT_FOUND'; end if;
  if not p_automatic and not exists(select 1 from live_v2.members where match_id=p_match and actor_id=p_actor) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  select * into c from live_v2.commands where match_id=p_match and command_id=p_command;
  if found then
    if c.actor_id is distinct from p_actor or c.automatic<>p_automatic then raise exception 'FORBIDDEN' using errcode='42501'; end if;
    if c.fingerprint<>p_fingerprint then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('status',case when c.accepted then 'confirmed' else 'rejected' end,'result',c.result);
  end if;
  r=jsonb_build_object('commandId',p_command,'version',m.version,'turn',m.turn_serial,
    'state',live_v2.project_state(m.state,p_actor),'rejected',true,'error',jsonb_build_object('code',p_error_code));
  insert into live_v2.commands(match_id,command_id,actor_id,automatic,fingerprint,accepted,
    expected_version,expected_turn,result,error_code)
    values(p_match,p_command,p_actor,p_automatic,p_fingerprint,false,p_expected_version,p_expected_turn,r,p_error_code);
  return jsonb_build_object('status','rejected','result',r);
end $$;

create function public.live_v2_recover_command(p_actor uuid,p_match uuid,p_command uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c live_v2.commands;
begin
  if not exists(select 1 from live_v2.members where match_id=p_match and actor_id=p_actor) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  select * into c from live_v2.commands where match_id=p_match and command_id=p_command;
  if not found then return jsonb_build_object('status','not_registered','commandId',p_command); end if;
  if c.actor_id is distinct from p_actor or c.automatic then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  return jsonb_build_object('status',case when c.accepted then 'confirmed' else 'rejected' end,'result',c.result);
end $$;
create function public.live_v2_claim_expired(p_limit integer)
returns table(match_id uuid,command_id uuid,expected_version bigint,expected_turn bigint)
language sql security definer set search_path='' as $$
  -- Scanning is retryable. CAS provides ownership at commit; duplicate workers cannot advance twice.
  select id,gen_random_uuid(),version,turn_serial from live_v2.matches
    where phase='combat' and turn_deadline<=clock_timestamp()
    order by turn_deadline limit greatest(0,least(p_limit,100))
$$;

-- Every RPC is backend-only. No clients can read/write the private tables or call privileged helpers.
revoke all on schema live_v2 from public,anon,authenticated;
revoke all on all tables in schema live_v2 from public,anon,authenticated;
revoke execute on all functions in schema live_v2 from public,anon,authenticated;
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'live_v2_%'
  loop
    execute format('revoke execute on function %s from public,anon,authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
