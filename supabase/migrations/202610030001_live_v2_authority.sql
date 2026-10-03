-- REVIEW ONLY: do not apply before approval. Target: Lab szueqtkjclsumoadnien.
create schema if not exists live_v2;
create table live_v2.matches(id uuid primary key, version bigint not null default 0, phase text not null, turn_serial bigint not null default 0, turn_deadline timestamptz, state jsonb not null, updated_at timestamptz not null default clock_timestamp());
create table live_v2.commands(match_id uuid not null references live_v2.matches, command_id uuid not null, fingerprint text not null, actor_id uuid, accepted boolean not null, expected_version bigint not null, expected_turn bigint, result jsonb, error_code text, server_time timestamptz not null default clock_timestamp(), state_hash text, primary key(match_id,command_id));
alter table live_v2.matches enable row level security; alter table live_v2.commands enable row level security;
-- No client write policies: only the backend service role may confirm calculated results.
create or replace function live_v2.confirm_command(p_match uuid,p_command uuid,p_fingerprint text,p_expected_version bigint,p_expected_turn bigint,p_new_state jsonb,p_result jsonb,p_state_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare m live_v2.matches; c live_v2.commands;
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then raise exception 'backend_only' using errcode='42501'; end if;
 select * into c from live_v2.commands where match_id=p_match and command_id=p_command;
 if found then if c.fingerprint<>p_fingerprint then raise exception 'idempotency_conflict' using errcode='P0001'; end if; return c.result; end if;
 select * into m from live_v2.matches where id=p_match for update;
 if not found or m.version<>p_expected_version or (p_expected_turn is not null and m.turn_serial<>p_expected_turn) then raise exception 'version_or_turn_conflict' using errcode='40001'; end if;
 update live_v2.matches set state=p_new_state,version=version+1,updated_at=clock_timestamp() where id=p_match;
 insert into live_v2.commands(match_id,command_id,fingerprint,accepted,expected_version,expected_turn,result,state_hash) values(p_match,p_command,p_fingerprint,true,p_expected_version,p_expected_turn,p_result,p_state_hash);
 return p_result;
end$$;
revoke all on schema live_v2 from anon,authenticated; revoke all on all tables in schema live_v2 from anon,authenticated; revoke all on function live_v2.confirm_command(uuid,uuid,text,bigint,bigint,jsonb,jsonb,text) from public,anon,authenticated;
