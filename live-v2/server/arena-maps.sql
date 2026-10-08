-- Sort once when the room is created. Existing matches retain their original arena.
CREATE OR REPLACE FUNCTION live_v2.roll_arena() RETURNS jsonb LANGUAGE sql VOLATILE SET search_path TO '' AS $arena$
 select value from jsonb_array_elements('[{"id":"central-01","name":"Arena Central · 1","revision":1,"deployment":{"A":["1,0","0,1","1,2","0,3","1,4","0,5","1,6","0,7","1,8","0,9","1,10","0,11"],"B":["10,11","11,10","10,9","11,8","10,7","11,6","10,5","11,4","10,3","11,2","10,1","11,0"]},"pieces":[{"id":"central-01-0","type":"barrier","cells":[{"x":3,"y":1},{"x":3,"y":2}]},{"id":"central-01-1","type":"barrier","cells":[{"x":3,"y":5},{"x":3,"y":6}]},{"id":"central-01-2","type":"barrier","cells":[{"x":3,"y":9},{"x":3,"y":10}]},{"id":"central-01-3","type":"pillar","cells":[{"x":6,"y":3}]},{"id":"central-01-4","type":"cube","cells":[{"x":5,"y":5}]},{"id":"central-01-5","type":"barrier","cells":[{"x":8,"y":10},{"x":8,"y":9}]},{"id":"central-01-6","type":"barrier","cells":[{"x":8,"y":6},{"x":8,"y":5}]},{"id":"central-01-7","type":"barrier","cells":[{"x":8,"y":2},{"x":8,"y":1}]},{"id":"central-01-8","type":"pillar","cells":[{"x":5,"y":8}]},{"id":"central-01-9","type":"cube","cells":[{"x":6,"y":6}]}]},{"id":"central-02","name":"Arena Central · 2","revision":1,"deployment":{"A":["1,0","1,1","2,1","1,3","2,3","1,4","2,6","1,7","2,7","1,9","1,10","2,10"],"B":["10,11","10,10","9,10","10,8","9,8","10,7","9,5","10,4","9,4","10,2","10,1","9,1"]},"pieces":[{"id":"central-02-0","type":"pillar","cells":[{"x":4,"y":0}]},{"id":"central-02-1","type":"cube","cells":[{"x":3,"y":4}]},{"id":"central-02-2","type":"pillar","cells":[{"x":8,"y":4}]},{"id":"central-02-3","type":"barrier","cells":[{"x":5,"y":1},{"x":5,"y":2}]},{"id":"central-02-4","type":"barrier","cells":[{"x":5,"y":4},{"x":6,"y":4}]},{"id":"central-02-5","type":"pillar","cells":[{"x":7,"y":11}]},{"id":"central-02-6","type":"cube","cells":[{"x":8,"y":7}]},{"id":"central-02-7","type":"pillar","cells":[{"x":3,"y":7}]},{"id":"central-02-8","type":"barrier","cells":[{"x":6,"y":10},{"x":6,"y":9}]},{"id":"central-02-9","type":"barrier","cells":[{"x":6,"y":7},{"x":5,"y":7}]}]},{"id":"central-03","name":"Arena Central · 3","revision":1,"deployment":{"A":["1,0","1,1","3,2","3,3","1,5","2,5","1,6","2,6","3,8","3,9","1,10","1,11"],"B":["10,11","10,10","8,9","8,8","10,6","9,6","10,5","9,5","8,3","8,2","10,1","10,0"]},"pieces":[{"id":"central-03-0","type":"cube","cells":[{"x":2,"y":1}]},{"id":"central-03-1","type":"pillar","cells":[{"x":5,"y":1}]},{"id":"central-03-2","type":"cube","cells":[{"x":9,"y":1}]},{"id":"central-03-3","type":"pillar","cells":[{"x":1,"y":4}]},{"id":"central-03-4","type":"pillar","cells":[{"x":10,"y":4}]},{"id":"central-03-5","type":"barrier","cells":[{"x":5,"y":3},{"x":6,"y":3}]},{"id":"central-03-6","type":"barrier","cells":[{"x":3,"y":5},{"x":3,"y":6}]},{"id":"central-03-7","type":"cube","cells":[{"x":9,"y":10}]},{"id":"central-03-8","type":"pillar","cells":[{"x":6,"y":10}]},{"id":"central-03-9","type":"cube","cells":[{"x":2,"y":10}]},{"id":"central-03-10","type":"pillar","cells":[{"x":10,"y":7}]},{"id":"central-03-11","type":"pillar","cells":[{"x":1,"y":7}]},{"id":"central-03-12","type":"barrier","cells":[{"x":6,"y":8},{"x":5,"y":8}]},{"id":"central-03-13","type":"barrier","cells":[{"x":8,"y":6},{"x":8,"y":5}]}]}]'::jsonb) with ordinality order by ordinality offset floor(random()*3)::int limit 1;
$arena$;
REVOKE ALL ON FUNCTION live_v2.roll_arena() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.live_v2_create_flexible_room(p_actor uuid, p_match uuid, p_layout jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  s=jsonb_set(s,'{arena}',live_v2.roll_arena());
  insert into live_v2.matches(id,creator_id,phase,state) values(p_match,p_actor,'preparation',s);
  insert into live_v2.members select p_match,p_actor,key,left(key,1),right(key,1)::smallint from jsonb_each(roster) where value->>'controllerId'=p_actor::text;
  return live_v2.project_state(s,p_actor);
end $function$
;
CREATE OR REPLACE FUNCTION public.live_v2_create_room(p_actor uuid, p_match uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  s=jsonb_set(s,'{arena}',live_v2.roll_arena());
  insert into live_v2.matches(id,creator_id,phase,state) values(p_match,p_actor,'preparation',s);
  insert into live_v2.members values(p_match,p_actor,'A1','A',1);
  return live_v2.project_state(s,p_actor);
end $function$
;
CREATE OR REPLACE FUNCTION public.live_v2_create_team_room(p_actor uuid, p_match uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  s=jsonb_set(s,'{arena}',live_v2.roll_arena());
  insert into live_v2.matches(id,creator_id,phase,state) values(p_match,p_actor,'preparation',s);
  insert into live_v2.members values(p_match,p_actor,'A1','A',1),(p_match,p_actor,'A2','A',2);
  return live_v2.project_state(s,p_actor);
end $function$
;
