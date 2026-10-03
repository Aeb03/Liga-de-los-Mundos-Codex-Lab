-- REVIEW ONLY. Future target: Lab szueqtkjclsumoadnien.
create schema if not exists live_v2;
create table live_v2.matches (
  id uuid primary key, creator_id uuid not null, version bigint not null default 0,
  phase text not null check (phase in ('preparation','deployment','combat','finished')),
  turn_serial bigint not null default 0, turn_deadline timestamptz, state jsonb not null,
  updated_at timestamptz not null default clock_timestamp()
);
create table live_v2.members (
  match_id uuid references live_v2.matches on delete cascade, actor_id uuid not null,
  slot_id text not null check (slot_id ~ '^[AB][1-3]$'), team text not null check (team in ('A','B')),
  slot smallint not null check (slot between 1 and 3), primary key(match_id,slot_id), unique(match_id,team,slot),
  check (slot_id = team || slot::text)
);
create table live_v2.commands (
  match_id uuid references live_v2.matches on delete cascade, command_id uuid not null,
  actor_id uuid not null, fingerprint text not null, accepted boolean not null,
  expected_version bigint not null, expected_turn bigint, result jsonb, error_code text,
  server_time timestamptz not null default clock_timestamp(), state_hash text,
  primary key(match_id,command_id)
);
alter table live_v2.matches enable row level security;
alter table live_v2.members enable row level security;
alter table live_v2.commands enable row level security;

create or replace function live_v2.confirm_command(
  p_actor uuid, p_match uuid, p_command uuid, p_fingerprint text,
  p_expected_version bigint, p_expected_turn bigint, p_expected_phase text,
  p_new_phase text, p_new_turn bigint, p_new_deadline timestamptz,
  p_new_state jsonb, p_result jsonb, p_state_hash text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare m live_v2.matches; c live_v2.commands;
begin
  if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then raise exception 'backend_only' using errcode='42501'; end if;
  select * into m from live_v2.matches where id=p_match for update;
  if not found then raise exception 'match_not_found' using errcode='P0002'; end if;
  select * into c from live_v2.commands where match_id=p_match and command_id=p_command;
  if found then
    if c.actor_id<>p_actor then raise exception 'private_result' using errcode='42501'; end if;
    if c.fingerprint<>p_fingerprint then raise exception 'idempotency_conflict' using errcode='P0001'; end if;
    return c.result;
  end if;
  if not exists(select 1 from live_v2.members where match_id=p_match and actor_id=p_actor) then raise exception 'not_member' using errcode='42501'; end if;
  if m.version<>p_expected_version or m.phase<>p_expected_phase or (p_expected_turn is not null and m.turn_serial<>p_expected_turn) then raise exception 'stale_conditions' using errcode='40001'; end if;
  if m.phase='combat' and p_expected_turn is not null and clock_timestamp()>=m.turn_deadline then raise exception 'turn_expired' using errcode='P0001'; end if;
  if p_new_phase='combat' and p_new_deadline is null then raise exception 'deadline_required' using errcode='P0001'; end if;
  if p_new_phase='finished' and p_new_deadline is not null then raise exception 'finished_has_deadline' using errcode='P0001'; end if;
  update live_v2.matches set state=p_new_state, phase=p_new_phase, turn_serial=p_new_turn,
    turn_deadline=p_new_deadline, version=version+1, updated_at=clock_timestamp() where id=p_match;
  insert into live_v2.commands values(p_match,p_command,p_actor,p_fingerprint,true,p_expected_version,p_expected_turn,p_result,null,clock_timestamp(),p_state_hash);
  return p_result;
exception when others then
  if sqlstate not in ('40001','42501') then
    insert into live_v2.commands(match_id,command_id,actor_id,fingerprint,accepted,expected_version,expected_turn,error_code,state_hash)
      values(p_match,p_command,p_actor,p_fingerprint,false,p_expected_version,p_expected_turn,sqlerrm,p_state_hash)
      on conflict(match_id,command_id) do nothing;
  end if;
  raise;
end$$;
revoke all on schema live_v2 from anon,authenticated;
revoke all on all tables in schema live_v2 from anon,authenticated;
revoke all on all functions in schema live_v2 from public,anon,authenticated;
