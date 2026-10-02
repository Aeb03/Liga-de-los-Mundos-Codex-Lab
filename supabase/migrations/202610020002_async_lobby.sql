create or replace function public.async_cached(p_request uuid,p_operation text) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$select response from public.async_requests where user_id=auth.uid() and request_id=p_request and operation=p_operation$$;
create or replace function public.async_store(p_request uuid,p_operation text,p_response jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$begin insert into public.async_requests(user_id,request_id,operation,response) values(auth.uid(),p_request,p_operation,p_response) on conflict(user_id,request_id) do nothing; return p_response; end$$;

create or replace function public.async_create_match(p_request_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare cached jsonb; mid uuid; mem uuid; code text; out jsonb;
begin
 if auth.uid() is null then raise exception 'authentication required'; end if;
 cached:=public.async_cached(p_request_id,'create'); if cached is not null then return cached; end if;
 loop code:=upper(substr(encode(gen_random_bytes(6),'hex'),1,6)); exit when not exists(select 1 from public.async_matches where room_code=code); end loop;
 insert into public.async_matches(room_code,created_by) values(code,auth.uid()) returning id into mid;
 insert into public.async_members(match_id,user_id,team,slot_number,turn_position) values(mid,auth.uid(),'A',1,1) returning id into mem;
 out:=jsonb_build_object('match_id',mid,'member_id',mem,'room_code',code,'team','A');
 perform public.async_store(p_request_id,'create',out); return out;
end$$;

create or replace function public.async_join_match(p_room_code text,p_request_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare cached jsonb; m public.async_matches%rowtype; mem uuid; out jsonb;
begin
 if auth.uid() is null then raise exception 'authentication required'; end if;
 cached:=public.async_cached(p_request_id,'join'); if cached is not null then return cached; end if;
 select * into m from public.async_matches where room_code=upper(trim(p_room_code)) for update;
 if m.id is null then raise exception 'room not found'; end if;
 if m.status<>'forming' then raise exception 'room already started'; end if;
 select id into mem from public.async_members where match_id=m.id and user_id=auth.uid();
 if mem is null then
   if (select count(*) from public.async_members where match_id=m.id)>=2 then raise exception 'room full'; end if;
   insert into public.async_members(match_id,user_id,team,slot_number,turn_position) values(m.id,auth.uid(),'B',1,2) returning id into mem;
 end if;
 out:=jsonb_build_object('match_id',m.id,'member_id',mem,'room_code',m.room_code,'team',(select team from public.async_members where id=mem));
 perform public.async_store(p_request_id,'join',out); return out;
end$$;

create or replace function public.async_prepare_member(p_match_id uuid,p_champion_id text,p_loadout jsonb,p_deploy_x int,p_deploy_y int,p_ready boolean,p_request_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare cached jsonb; mem public.async_members%rowtype; out jsonb;
begin
 cached:=public.async_cached(p_request_id,'prepare'); if cached is not null then return cached; end if;
 if jsonb_typeof(p_loadout)<>'array' or jsonb_array_length(p_loadout)>4 or (p_ready and jsonb_array_length(p_loadout)<>4) then raise exception 'loadout must contain exactly 4 skills when ready'; end if;
 if p_deploy_x not between 0 and 11 or p_deploy_y not between 0 and 11 then raise exception 'invalid deployment'; end if;
 select * into mem from public.async_members where match_id=p_match_id and user_id=auth.uid() for update;
 if mem.id is null then raise exception 'not a member'; end if;
 if (select status from public.async_matches where id=p_match_id)<>'forming' then raise exception 'match already initialized'; end if;
 update public.async_members set champion_id=p_champion_id,loadout=p_loadout,deploy_x=p_deploy_x,deploy_y=p_deploy_y,ready=p_ready where id=mem.id;
 out:=jsonb_build_object('ok',true,'member_id',mem.id); perform public.async_store(p_request_id,'prepare',out); return out;
end$$;

create or replace function public.async_initialize_match(p_match_id uuid,p_snapshot jsonb,p_request_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare cached jsonb; m public.async_matches%rowtype; active_unit text; active_member uuid; h text; out jsonb;
begin
 cached:=public.async_cached(p_request_id,'initialize'); if cached is not null then return cached; end if;
 select * into m from public.async_matches where id=p_match_id for update;
 if m.id is null or not public.async_is_member(m.id) then raise exception 'not a member'; end if;
 if m.status<>'forming' then raise exception 'already initialized'; end if;
 if (select count(*) from public.async_members where match_id=m.id)<>2 or exists(select 1 from public.async_members where match_id=m.id and (not ready or champion_id is null)) then raise exception 'both players must be ready'; end if;
 if not public.async_snapshot_valid(p_snapshot) or coalesce((p_snapshot->>'turnSequence')::bigint,-1)<>0 then raise exception 'invalid initial snapshot'; end if;
 active_unit:=p_snapshot#>>'{battle,order,0}';
 select id into active_member from public.async_members where match_id=m.id and ('online-'||team||'-'||slot_number)=active_unit;
 if active_member is null then raise exception 'snapshot active unit does not match roster'; end if;
 h:=public.async_hash(p_snapshot);
 update public.async_matches set status='waiting',snapshot=p_snapshot,snapshot_hash=h,state_version=1,turn_sequence=0,active_member_id=active_member,turn_started_at=null,turn_deadline=null,waiting_deadline=clock_timestamp()+interval '12 hours',updated_at=clock_timestamp() where id=m.id;
 out:=jsonb_build_object('ok',true,'match_id',m.id,'state_version',1,'snapshot_hash',h,'active_member_id',active_member);
 insert into public.async_audit(match_id,user_id,operation,state_version) values(m.id,auth.uid(),'initialize',1);
 perform public.async_store(p_request_id,'initialize',out); return out;
end$$;

revoke all on function public.async_cached(uuid,text),public.async_store(uuid,text,jsonb) from public;
revoke all on function public.async_create_match(uuid),public.async_join_match(text,uuid),public.async_prepare_member(uuid,text,jsonb,int,int,boolean,uuid),public.async_initialize_match(uuid,jsonb,uuid) from public;
grant execute on function public.async_create_match(uuid),public.async_join_match(text,uuid),public.async_prepare_member(uuid,text,jsonb,int,int,boolean,uuid),public.async_initialize_match(uuid,jsonb,uuid) to authenticated;
