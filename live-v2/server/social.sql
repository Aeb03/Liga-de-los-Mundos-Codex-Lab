-- Private social data. All access goes through one authenticated, bounded RPC.
create table live_v2.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 name text not null check(char_length(name) between 3 and 24),
 code text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),
 created_at timestamptz not null default now()
);
create table live_v2.friendships (
 sender uuid not null references live_v2.profiles(id) on delete cascade,
 recipient uuid not null references live_v2.profiles(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','accepted')),
 created_at timestamptz not null default now(),
 primary key(sender,recipient), check(sender<>recipient)
);
create unique index friendship_pair on live_v2.friendships(least(sender,recipient),greatest(sender,recipient));
create table live_v2.invitations (
 id uuid primary key default gen_random_uuid(),
 sender uuid not null references live_v2.profiles(id) on delete cascade,
 recipient uuid not null references live_v2.profiles(id) on delete cascade,
 match_id uuid not null references live_v2.matches(id) on delete cascade,
 slot_id text not null check(slot_id in ('A2','B1','B2')),
 status text not null default 'pending' check(status in ('pending','accepted','declined')),
 expires_at timestamptz not null default now()+interval '30 minutes',
 created_at timestamptz not null default now(), check(sender<>recipient)
);
create index invitations_recipient on live_v2.invitations(recipient,status);
alter table live_v2.profiles enable row level security;
alter table live_v2.friendships enable row level security;
alter table live_v2.invitations enable row level security;
revoke all on live_v2.profiles,live_v2.friendships,live_v2.invitations from public,anon,authenticated;

create or replace function live_v2.social(p_action text,p_args jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
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
  if p_args->>'slot' not in ('A2','B1','B2') or p_args->>'slot' is null then raise exception 'SLOT_UNAVAILABLE'; end if;
  if m.state->>'players'<>'4' and p_args->>'slot'<>'B1' then raise exception 'SLOT_UNAVAILABLE'; end if;
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
end $$;
create or replace function public.live_v2_social(p_action text,p_args jsonb default '{}')
returns jsonb language sql security invoker set search_path='' as $$ select live_v2.social(p_action,p_args) $$;
revoke all on function live_v2.social(text,jsonb) from public,anon;
grant usage on schema live_v2 to authenticated;
grant execute on function live_v2.social(text,jsonb) to authenticated;
revoke all on function public.live_v2_social(text,jsonb) from public,anon;
grant execute on function public.live_v2_social(text,jsonb) to authenticated;
