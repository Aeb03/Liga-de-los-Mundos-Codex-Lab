CREATE OR REPLACE FUNCTION public.live_v2_create_flexible_room(p_actor uuid, p_match uuid, p_layout jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s jsonb; id text; group_id text; entry jsonb; roster jsonb='{}'; bot boolean; ids text[]; seats integer;
begin
  if p_actor is null or p_match is null or jsonb_typeof(p_layout)<>'object' or (select count(*) from jsonb_object_keys(p_layout))not in (2,4,6) then raise exception 'INVALID_LAYOUT'; end if;
  seats=(select count(*) from jsonb_object_keys(p_layout));
  ids=case when seats=2 then array['A1','B1'] when seats=4 then array['A1','A2','B1','B2'] else array['A1','A2','A3','B1','B2','B3'] end;
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
  s=jsonb_build_object('id',p_match,'creatorId',p_actor,'mode',case when seats=2 then '1v1' when seats=4 then '2v2' else '3v3' end,'players',seats,'flexible',true,'preparationFlow',true,'phase','preparation','version',0,
    'turnSerial',0,'turnDeadline',null,'combat',null,'result',null,'slots',roster,'createdAt',floor(extract(epoch from clock_timestamp())*1000),'diagnostics','[]'::jsonb);
  s=jsonb_set(s,'{arena}',live_v2.roll_arena());
  insert into live_v2.matches(id,creator_id,phase,state) values(p_match,p_actor,'preparation',s);
  insert into live_v2.members select p_match,p_actor,key,left(key,1),right(key,1)::smallint from jsonb_each(roster) where value->>'controllerId'=p_actor::text;
  return live_v2.project_state(s,p_actor);
end $function$;

CREATE OR REPLACE FUNCTION live_v2.social(p_action text, p_args jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid=auth.uid(); target uuid; invite live_v2.invitations; m live_v2.matches; result jsonb; n text;
begin
 if actor is null or not exists(select 1 from auth.users where id=actor and not is_anonymous and email_confirmed_at is not null) then raise exception 'ACCOUNT_REQUIRED'; end if;
 -- Serializes per-account writes and limits races in requests/invitations.
 perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
 if p_action='profile' then
  n=btrim(p_args->>'name');
  if n is null or char_length(n) not between 3 and 24 then raise exception 'INVALID_NAME'; end if;
  insert into live_v2.profiles(id,name) values(actor,n) on conflict(id) do update set name=excluded.name;
 elsif p_action='request' then
  select id into target from live_v2.profiles where code=upper(btrim(p_args->>'code'));
  if target is null or target=actor then raise exception 'PLAYER_NOT_FOUND'; end if;
  if not exists(select 1 from live_v2.profiles where id=actor) then raise exception 'PROFILE_REQUIRED'; end if;
  if (select count(*) from live_v2.friendships where sender=actor or recipient=actor)>=100 then raise exception 'FRIEND_LIMIT'; end if;
  insert into live_v2.friendships(sender,recipient) values(actor,target) on conflict do nothing;
 elsif p_action in ('acceptFriend','removeFriend') then
  target=(p_args->>'id')::uuid;
  if p_action='acceptFriend' then update live_v2.friendships set status='accepted' where sender=target and recipient=actor and status='pending';
  else delete from live_v2.friendships where (sender=actor and recipient=target) or (sender=target and recipient=actor); end if;
 elsif p_action='invite' then
  target=(p_args->>'id')::uuid;
  if not exists(select 1 from live_v2.friendships where status='accepted' and ((sender=actor and recipient=target) or (sender=target and recipient=actor))) then raise exception 'FRIEND_REQUIRED'; end if;
  select * into m from live_v2.matches where id=(p_args->>'matchId')::uuid for update;
  if not found or m.phase<>'preparation' then raise exception 'JOIN_CLOSED'; end if;
  if m.state#>>'{slots,A1,controllerId}'<>actor::text then raise exception 'FORBIDDEN'; end if;
  if p_args->>'slot' not in ('A2','A3','B1','B2','B3') or p_args->>'slot' is null then raise exception 'SLOT_UNAVAILABLE'; end if;
  if m.state->>'players' not in ('4','6') and p_args->>'slot'<>'B1' then raise exception 'SLOT_UNAVAILABLE'; end if;
  if not (m.state->'slots' ? (p_args->>'slot')) or m.state->'slots'->(p_args->>'slot')->>'controllerKind'='ai' then raise exception 'SLOT_UNAVAILABLE'; end if;
  if exists(select 1 from live_v2.members where match_id=m.id and slot_id=p_args->>'slot') then raise exception 'SLOT_TAKEN'; end if;
  update live_v2.invitations set status='declined' where match_id=m.id and slot_id=p_args->>'slot' and status='pending';
  insert into live_v2.invitations(sender,recipient,match_id,slot_id) values(actor,target,m.id,p_args->>'slot');
 elsif p_action in ('acceptInvite','declineInvite') then
  select * into invite from live_v2.invitations where id=(p_args->>'id')::uuid and recipient=actor for update;
  if not found then raise exception 'FORBIDDEN'; end if;
  if invite.status='accepted' and p_action='acceptInvite' then return jsonb_build_object('matchId',invite.match_id); end if;
  if invite.status<>'pending' or invite.expires_at<now() then raise exception 'INVITE_EXPIRED'; end if;
  if p_action='acceptInvite' then
   perform public.live_v2_join_room(actor,invite.match_id,invite.slot_id);
   update live_v2.invitations set status='accepted' where id=invite.id;
   return jsonb_build_object('matchId',invite.match_id);
  end if;
  update live_v2.invitations set status='declined' where id=invite.id;
 elsif p_action<>'list' then raise exception 'INVALID_OPERATION'; end if;
 select jsonb_build_object(
 'profile',(select to_jsonb(p) from live_v2.profiles p where id=actor),
 'friends',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'code',p.code,'status',f.status,'incoming',f.recipient=actor)) from live_v2.friendships f join live_v2.profiles p on p.id=case when f.sender=actor then f.recipient else f.sender end where f.sender=actor or f.recipient=actor),'[]'),
 'invitations',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'name',p.name,'matchId',i.match_id,'slot',i.slot_id)) from live_v2.invitations i join live_v2.profiles p on p.id=i.sender join live_v2.matches r on r.id=i.match_id where i.recipient=actor and i.status='pending' and i.expires_at>now() and r.phase='preparation'),'[]')) into result;
 return result;
end $function$;

alter table live_v2.invitations drop constraint invitations_slot_id_check;
alter table live_v2.invitations add constraint invitations_slot_id_check check (slot_id in ('A2','A3','B1','B2','B3'));

create or replace function live_v2.project_state(p_state jsonb,p_actor uuid)
returns jsonb language sql immutable set search_path='' as $$
select jsonb_set(p_state,'{slots}',(
 select jsonb_object_agg(k,case
 when p_state->>'mode'='3v3' and p_state->>'phase'='preparation' and coalesce(p_state->>'countdownDeadline','')='' and not exists(
  select 1 from jsonb_each(p_state->'slots') own where own.value->>'controllerId'=p_actor::text and own.value->>'team'=v->>'team')
 then jsonb_set(jsonb_set(v,'{championId}','null'),'{skills}','[]')
 when p_state->>'phase'='deployment' and v->>'controllerId' is distinct from p_actor::text
 then jsonb_set(jsonb_set(v,'{position}','null'),'{controllerId}','null')
 else v end) from jsonb_each(p_state->'slots') e(k,v)
)) - 'diagnostics'
$$;
