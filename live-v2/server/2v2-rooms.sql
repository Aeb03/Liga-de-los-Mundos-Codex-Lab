-- LAB2 only. Existing 1v1 create RPC stays unchanged. One controller per team.
create or replace function public.live_v2_create_team_room(p_actor uuid,p_match uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s jsonb; slot_id text; team_id text; slot_number integer; roster jsonb='{}';
begin
  if p_actor is null or p_match is null then raise exception 'INVALID_ROOM'; end if;
  foreach team_id in array array['A','B'] loop
    for slot_number in 1..2 loop
      slot_id=team_id||slot_number::text;
      roster=roster||jsonb_build_object(slot_id,jsonb_build_object('id',slot_id,'team',team_id,'slot',slot_number,
        'controllerId',case when team_id='A' then p_actor else null end,'championId',null,
        'skills',jsonb_build_array(),'ready',false,'position',null,'confirmed',false));
    end loop;
  end loop;
  s=jsonb_build_object('id',p_match,'creatorId',p_actor,'mode','2v2','phase','preparation','version',0,
    'turnSerial',0,'turnDeadline',null,'combat',null,'result',null,'slots',roster,
    'createdAt',floor(extract(epoch from clock_timestamp())*1000),'diagnostics',jsonb_build_array());
  insert into live_v2.matches(id,creator_id,phase,state) values(p_match,p_actor,'preparation',s);
  insert into live_v2.members values(p_match,p_actor,'A1','A',1),(p_match,p_actor,'A2','A',2);
  return live_v2.project_state(s,p_actor);
end $$;
revoke all on function public.live_v2_create_team_room(uuid,uuid) from public,anon,authenticated;
grant execute on function public.live_v2_create_team_room(uuid,uuid) to service_role;

create or replace function public.live_v2_join_room(p_actor uuid,p_match uuid,p_slot text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare m live_v2.matches; slot_number integer; assigned_slot_id text; team_size integer;
begin
  if p_actor is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into m from live_v2.matches where id=p_match for update;
  if not found then raise exception 'MATCH_NOT_FOUND'; end if;
  if p_slot is distinct from 'B1' then raise exception 'SLOT_UNAVAILABLE'; end if;
  if exists(select 1 from live_v2.members where match_id=p_match and slot_id='B1') then
    if exists(select 1 from live_v2.members where match_id=p_match and slot_id='B1' and actor_id=p_actor) then
      return live_v2.project_state(m.state,p_actor);
    end if;
    raise exception 'SLOT_TAKEN';
  end if;
  if m.phase<>'preparation' then raise exception 'JOIN_CLOSED'; end if;
  if exists(select 1 from live_v2.members where match_id=p_match and actor_id=p_actor) then raise exception 'SLOT_UNAVAILABLE'; end if;
  team_size=case when m.state->>'mode'='2v2' then 2 else 1 end;
  for slot_number in 1..team_size loop
    assigned_slot_id='B'||slot_number::text;
    insert into live_v2.members values(p_match,p_actor,assigned_slot_id,'B',slot_number);
    m.state=jsonb_set(m.state,array['slots',assigned_slot_id,'controllerId'],to_jsonb(p_actor));
  end loop;
  m.state=jsonb_set(m.state,'{version}',to_jsonb(m.version+1));
  update live_v2.matches set state=m.state,version=version+1,updated_at=clock_timestamp() where id=p_match;
  return live_v2.project_state(m.state,p_actor);
end $$;
