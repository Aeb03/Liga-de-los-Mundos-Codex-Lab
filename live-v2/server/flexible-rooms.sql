-- Only the authenticated Edge service can create or join these rooms.
create or replace function public.live_v2_create_flexible_room(p_actor uuid,p_match uuid,p_layout jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s jsonb; id text; group_id text; entry jsonb; roster jsonb='{}'; bot boolean;
begin
  if p_actor is null or p_match is null or jsonb_typeof(p_layout)<>'object' or (select count(*) from jsonb_object_keys(p_layout))<>4 then raise exception 'INVALID_LAYOUT'; end if;
  foreach id in array array['A1','A2','B1','B2'] loop
    entry=p_layout->id; group_id=entry->>'controller'; bot=group_id='ai';
    if group_id is null or group_id not in (id,left(id,1)||'1','ai') or (id='A1' and group_id<>'A1') then raise exception 'INVALID_LAYOUT'; end if;
    if not bot and group_id<>id and p_layout->group_id->>'controller' is distinct from group_id then raise exception 'INVALID_LAYOUT'; end if;
    if bot and (entry->>'championId' not in ('arfeli','coloso','piplus','onod','korgan','houngan') or jsonb_array_length(entry->'skills')<>4) then raise exception 'INVALID_SELECTION'; end if;
    roster=roster||jsonb_build_object(id,jsonb_build_object('id',id,'team',left(id,1),'slot',right(id,1)::int,
      'controllerGroup',case when bot then id else group_id end,'controllerKind',case when bot then 'ai' else 'human' end,
      'controllerId',case when bot then 'ai:'||id when group_id='A1' then p_actor::text else null end,
      'championId',case when bot then entry->>'championId' else null end,'skills',case when bot then entry->'skills' else '[]'::jsonb end,
      'ready',bot,'position',null,'confirmed',false));
  end loop;
  if exists(select 1 from jsonb_each(roster) a join jsonb_each(roster) b on a.key<b.key and a.value->>'team'=b.value->>'team' and a.value->>'championId'=b.value->>'championId') then raise exception 'DUPLICATE_CHAMPION'; end if;
  s=jsonb_build_object('id',p_match,'creatorId',p_actor,'mode','2v2','players',4,'flexible',true,'phase','preparation','version',0,
    'turnSerial',0,'turnDeadline',null,'combat',null,'result',null,'slots',roster,'createdAt',floor(extract(epoch from clock_timestamp())*1000),'diagnostics','[]'::jsonb);
  insert into live_v2.matches(id,creator_id,phase,state) values(p_match,p_actor,'preparation',s);
  insert into live_v2.members select p_match,p_actor,key,left(key,1),right(key,1)::smallint from jsonb_each(roster) where value->>'controllerId'=p_actor::text;
  return live_v2.project_state(s,p_actor);
end $$;
revoke all on function public.live_v2_create_flexible_room(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.live_v2_create_flexible_room(uuid,uuid,jsonb) to service_role;

create or replace function public.live_v2_join_room(p_actor uuid,p_match uuid,p_slot text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare m live_v2.matches; slot_number integer; assigned_slot_id text; team_size integer; group_id text; entry record;
begin
  if p_actor is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into m from live_v2.matches where id=p_match for update;
  if not found then raise exception 'MATCH_NOT_FOUND'; end if;

  if m.state->>'flexible'='true' then
    if p_slot is null or not (m.state->'slots' ? p_slot) then raise exception 'SLOT_UNAVAILABLE'; end if;
    group_id=m.state->'slots'->p_slot->>'controllerGroup';
    if m.state->'slots'->p_slot->>'controllerKind'<>'human' then raise exception 'SLOT_UNAVAILABLE'; end if;
    if exists(select 1 from live_v2.members where match_id=p_match and actor_id=p_actor and team<>left(p_slot,1)) then raise exception 'SLOT_UNAVAILABLE'; end if;
    if m.state->'slots'->p_slot->>'controllerId'=p_actor::text then return live_v2.project_state(m.state,p_actor); end if;
    if m.phase<>'preparation' then raise exception 'JOIN_CLOSED'; end if;
    if m.state->'slots'->p_slot->>'controllerId' is not null then raise exception 'SLOT_TAKEN'; end if;
    -- One identity may not occupy independently invited seats; shared seats are explicit in the layout.
    if exists(select 1 from live_v2.members where match_id=p_match and actor_id=p_actor) then raise exception 'SLOT_UNAVAILABLE'; end if;
    for entry in select key,value from jsonb_each(m.state->'slots') where value->>'controllerGroup'=group_id and value->>'controllerKind'='human' loop
      if entry.value->>'controllerId' is not null then raise exception 'SLOT_TAKEN'; end if;
      insert into live_v2.members values(p_match,p_actor,entry.key,left(entry.key,1),right(entry.key,1)::smallint);
      m.state=jsonb_set(m.state,array['slots',entry.key,'controllerId'],to_jsonb(p_actor));
    end loop;
    m.state=jsonb_set(m.state,'{version}',to_jsonb(m.version+1));
    update live_v2.matches set state=m.state,version=version+1,updated_at=clock_timestamp() where id=p_match;
    return live_v2.project_state(m.state,p_actor);
  end if;

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


