-- Run inside BEGIN/ROLLBACK; never creates persistent user accounts.
do $$
declare a uuid=gen_random_uuid(); b uuid=gen_random_uuid(); c uuid=gen_random_uuid(); room uuid=gen_random_uuid(); code_b text; invitation uuid; response jsonb;
begin
 insert into auth.users(id,email,email_confirmed_at,is_anonymous) values(a,'qa-a@example.invalid',now(),false),(b,'qa-b@example.invalid',now(),false),(c,null,null,true);
 perform set_config('request.jwt.claim.sub',b::text,true);
 perform public.live_v2_social('profile','{"name":"QA B"}');
 select code into code_b from live_v2.profiles where id=b;
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform public.live_v2_social('profile','{"name":"QA A"}');
 perform public.live_v2_social('request',jsonb_build_object('code',code_b));
 perform public.live_v2_social('request',jsonb_build_object('code',code_b));
 if (select count(*) from live_v2.friendships where sender=a and recipient=b)<>1 then raise exception 'request dedupe failed'; end if;
 perform public.live_v2_create_four_player_room(a,room);
 begin
  perform public.live_v2_social('invite',jsonb_build_object('id',b,'matchId',room,'slot','A2'));
  raise exception 'unaccepted friend permitted';
 exception when others then if sqlerrm<>'FRIEND_REQUIRED' then raise; end if; end;
 perform set_config('request.jwt.claim.sub',b::text,true);
 perform public.live_v2_social('acceptFriend',jsonb_build_object('id',a));
 begin
  perform public.live_v2_social('invite',jsonb_build_object('id',a,'matchId',room,'slot','A2'));
  raise exception 'nonhost permitted';
 exception when others then if sqlerrm<>'FORBIDDEN' then raise; end if; end;
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform public.live_v2_social('invite',jsonb_build_object('id',b,'matchId',room,'slot','A2'));
 select id into invitation from live_v2.invitations where match_id=room;
 begin
  perform public.live_v2_social('acceptInvite',jsonb_build_object('id',invitation));
  raise exception 'wrong recipient permitted';
 exception when others then if sqlerrm<>'FORBIDDEN' then raise; end if; end;
 perform set_config('request.jwt.claim.sub',b::text,true);
 response=public.live_v2_social('acceptInvite',jsonb_build_object('id',invitation));
 perform public.live_v2_social('acceptInvite',jsonb_build_object('id',invitation));
 if response->>'matchId'<>room::text or not exists(select 1 from live_v2.members where match_id=room and actor_id=b and slot_id='A2') then raise exception 'accept failed'; end if;
 perform set_config('request.jwt.claim.sub',c::text,true);
 begin
  perform public.live_v2_social('list');raise exception 'anonymous permitted';
 exception when others then if sqlerrm<>'ACCOUNT_REQUIRED' then raise; end if; end;
 perform set_config('request.jwt.claim.sub',b::text,true);
 perform public.live_v2_social('removeFriend',jsonb_build_object('id',a));
 if exists(select 1 from live_v2.friendships where sender=a and recipient=b) then raise exception 'remove failed'; end if;
 delete from auth.users where id=b;
 if exists(select 1 from live_v2.profiles where id=b) or exists(select 1 from live_v2.invitations where recipient=b) then raise exception 'cascade failed'; end if;
end $$;
