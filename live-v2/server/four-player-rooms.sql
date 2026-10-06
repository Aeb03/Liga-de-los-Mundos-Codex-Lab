-- LAB2. Four authenticated controllers, one champion each; legacy 1v1/two-player 2v2 stay compatible.
create or replace function public.live_v2_create_four_player_room(p_actor uuid,p_match uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s jsonb;
begin
  perform public.live_v2_create_team_room(p_actor,p_match);
  select state into s from live_v2.matches where id=p_match;
  delete from live_v2.members where match_id=p_match and slot_id='A2';
  s=jsonb_set(s,'{slots,A2,controllerId}','null');
  s=jsonb_set(s,'{players}','4');
  update live_v2.matches set state=s where id=p_match;
  return live_v2.project_state(s,p_actor);
end $$;
revoke all on function public.live_v2_create_four_player_room(uuid,uuid) from public,anon,authenticated;
grant execute on function public.live_v2_create_four_player_room(uuid,uuid) to service_role;

create or replace function public.live_v2_join_room(p_actor uuid,p_match uuid,p_slot text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare m live_v2.matches; slot_number integer; assigned_slot_id text; team_size integer;
begin
  if p_actor is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into m from live_v2.matches where id=p_match for update;
  if not found then raise exception 'MATCH_NOT_FOUND'; end if;

  if m.state->>'players'='4' then
    if p_slot not in ('A2','B1','B2') or p_slot is null then raise exception 'SLOT_UNAVAILABLE'; end if;
    if exists(select 1 from live_v2.members where match_id=p_match and actor_id=p_actor) then
      if exists(select 1 from live_v2.members where match_id=p_match and actor_id=p_actor and slot_id=p_slot) then
        return live_v2.project_state(m.state,p_actor);
      end if;
      raise exception 'SLOT_UNAVAILABLE';
    end if;
    if exists(select 1 from live_v2.members where match_id=p_match and slot_id=p_slot) then raise exception 'SLOT_TAKEN'; end if;
    if m.phase<>'preparation' then raise exception 'JOIN_CLOSED'; end if;
    insert into live_v2.members values(p_match,p_actor,p_slot,left(p_slot,1),right(p_slot,1)::smallint);
    m.state=jsonb_set(m.state,array['slots',p_slot,'controllerId'],to_jsonb(p_actor));
    m.state=jsonb_set(m.state,'{version}',to_jsonb(m.version+1));
    update live_v2.matches set state=m.state,version=version+1,updated_at=clock_timestamp() where id=p_match;
    return live_v2.project_state(m.state,p_actor);
  end if;

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

