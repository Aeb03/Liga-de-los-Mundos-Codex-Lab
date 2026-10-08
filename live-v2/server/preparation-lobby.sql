CREATE OR REPLACE FUNCTION public.live_v2_create_flexible_room(p_actor uuid, p_match uuid, p_layout jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s jsonb; id text; group_id text; entry jsonb; roster jsonb='{}'; bot boolean; ids text[]; seats integer;
begin
  if p_actor is null or p_match is null or jsonb_typeof(p_layout)<>'object' or (select count(*) from jsonb_object_keys(p_layout))not in (2,4) then raise exception 'INVALID_LAYOUT'; end if;
  seats=(select count(*) from jsonb_object_keys(p_layout));
  ids=case when seats=2 then array['A1','B1'] else array['A1','A2','B1','B2'] end;
  foreach id in array ids loop
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
  s=jsonb_build_object('id',p_match,'creatorId',p_actor,'mode',case when seats=2 then '1v1' else '2v2' end,'players',seats,'flexible',true,'preparationFlow',true,'phase','preparation','version',0,
    'turnSerial',0,'turnDeadline',null,'combat',null,'result',null,'slots',roster,'createdAt',floor(extract(epoch from clock_timestamp())*1000),'diagnostics','[]'::jsonb);
  s=jsonb_set(s,'{arena}',live_v2.roll_arena());
  insert into live_v2.matches(id,creator_id,phase,state) values(p_match,p_actor,'preparation',s);
  insert into live_v2.members select p_match,p_actor,key,left(key,1),right(key,1)::smallint from jsonb_each(roster) where value->>'controllerId'=p_actor::text;
  return live_v2.project_state(s,p_actor);
end $function$
;

revoke all on function public.live_v2_create_flexible_room(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.live_v2_create_flexible_room(uuid,uuid,jsonb) to service_role;
