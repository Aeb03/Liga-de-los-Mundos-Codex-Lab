create or replace function public.async_start_turn(p_match_id uuid,p_expected_version bigint,p_timeout_snapshot jsonb,p_request_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare cached jsonb; m public.async_matches%rowtype; me uuid; th text; out jsonb;
begin
 cached:=public.async_cached(p_request_id,'start_turn'); if cached is not null then return cached; end if;
 select id into me from public.async_members where match_id=p_match_id and user_id=auth.uid();
 select * into m from public.async_matches where id=p_match_id for update;
 if me is null or m.active_member_id<>me then raise exception 'not your turn'; end if;
 if m.status not in ('waiting','active') then raise exception 'match not playable'; end if;
 if m.state_version<>p_expected_version then raise exception 'stale state version'; end if;
 if m.turn_started_at is not null then
   out:=jsonb_build_object('ok',true,'match',to_jsonb(m)); perform public.async_store(p_request_id,'start_turn',out); return out;
 end if;
 if clock_timestamp()>m.waiting_deadline then update public.async_matches set status='expired',updated_at=clock_timestamp() where id=m.id; raise exception 'waiting deadline expired'; end if;
 if not public.async_snapshot_valid(p_timeout_snapshot) or coalesce((p_timeout_snapshot->>'turnSequence')::bigint,-1)<>m.turn_sequence+1 then raise exception 'invalid timeout snapshot'; end if;
 th:=public.async_hash(p_timeout_snapshot);
 update public.async_matches set status='active',turn_started_at=clock_timestamp(),turn_deadline=clock_timestamp()+interval '30 seconds',timeout_snapshot=p_timeout_snapshot,timeout_snapshot_hash=th,updated_at=clock_timestamp() where id=m.id returning * into m;
 out:=jsonb_build_object('ok',true,'match',to_jsonb(m)); insert into public.async_audit(match_id,user_id,operation,state_version) values(m.id,auth.uid(),'start_turn',m.state_version);
 perform public.async_store(p_request_id,'start_turn',out); return out;
end$$;

create or replace function public.async_finish_turn(p_match_id uuid,p_expected_version bigint,p_expected_hash text,p_snapshot jsonb,p_request_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare cached jsonb; m public.async_matches%rowtype; me uuid; active_unit text; next_member uuid; h text; nextv bigint; out jsonb;
begin
 cached:=public.async_cached(p_request_id,'finish_turn'); if cached is not null then return cached; end if;
 select id into me from public.async_members where match_id=p_match_id and user_id=auth.uid();
 select * into m from public.async_matches where id=p_match_id for update;
 if me is null or m.active_member_id<>me then raise exception 'not your turn'; end if;
 if m.state_version<>p_expected_version or m.snapshot_hash is distinct from p_expected_hash then raise exception 'stale state/hash'; end if;
 if m.turn_started_at is null then raise exception 'turn was not started'; end if;
 if clock_timestamp()>m.turn_deadline then raise exception 'turn deadline expired'; end if;
 if not public.async_snapshot_valid(p_snapshot) or coalesce((p_snapshot->>'turnSequence')::bigint,-1)<>m.turn_sequence+1 then raise exception 'invalid next snapshot'; end if;
 active_unit:=p_snapshot#>>'{battle,order,'||(p_snapshot#>>'{battle,turn}')||'}';
 select id into next_member from public.async_members where match_id=m.id and ('online-'||team||'-'||slot_number)=active_unit;
 if next_member is null then raise exception 'snapshot authority does not match roster'; end if;
 h:=public.async_hash(p_snapshot);nextv:=m.state_version+1;
 update public.async_matches set status=case when coalesce((p_snapshot#>>'{battle,ended}')::boolean,false) then 'finished' else 'waiting' end,snapshot=p_snapshot,snapshot_hash=h,timeout_snapshot=null,timeout_snapshot_hash=null,state_version=nextv,turn_sequence=m.turn_sequence+1,active_member_id=next_member,turn_started_at=null,turn_deadline=null,waiting_deadline=clock_timestamp()+interval '12 hours',updated_at=clock_timestamp() where id=m.id;
 out:=jsonb_build_object('ok',true,'state_version',nextv,'snapshot_hash',h,'active_member_id',next_member);
 insert into public.async_audit(match_id,user_id,operation,state_version) values(m.id,auth.uid(),'finish_turn',nextv);
 perform public.async_store(p_request_id,'finish_turn',out); return out;
end$$;

create or replace function public.async_promote_timeouts(p_match_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.async_matches%rowtype; active_unit text; next_member uuid; nextv bigint;
begin
 select * into m from public.async_matches where id=p_match_id for update;
 if m.id is null or not public.async_is_member(m.id) then raise exception 'not a member'; end if;
 if m.status='waiting' and m.turn_started_at is null and clock_timestamp()>m.waiting_deadline then update public.async_matches set status='expired',updated_at=clock_timestamp() where id=m.id; return jsonb_build_object('status','expired'); end if;
 if m.turn_started_at is null or clock_timestamp()<=m.turn_deadline then return jsonb_build_object('status',m.status); end if;
 if not public.async_snapshot_valid(m.timeout_snapshot) then raise exception 'timeout snapshot missing or invalid'; end if;
 active_unit:=m.timeout_snapshot#>>'{battle,order,'||(m.timeout_snapshot#>>'{battle,turn}')||'}';
 select id into next_member from public.async_members where match_id=m.id and ('online-'||team||'-'||slot_number)=active_unit;
 if next_member is null then raise exception 'timeout authority does not match roster'; end if;
 nextv:=m.state_version+1;
 update public.async_matches set status=case when coalesce((timeout_snapshot#>>'{battle,ended}')::boolean,false) then 'finished' else 'waiting' end,snapshot=timeout_snapshot,snapshot_hash=timeout_snapshot_hash,state_version=nextv,turn_sequence=m.turn_sequence+1,active_member_id=next_member,timeout_snapshot=null,timeout_snapshot_hash=null,turn_started_at=null,turn_deadline=null,waiting_deadline=clock_timestamp()+interval '12 hours',updated_at=clock_timestamp() where id=m.id;
 insert into public.async_audit(match_id,user_id,operation,state_version) values(m.id,auth.uid(),'timeout',nextv);
 return jsonb_build_object('status','promoted','state_version',nextv,'active_member_id',next_member);
end$$;

revoke all on function public.async_start_turn(uuid,bigint,jsonb,uuid),public.async_finish_turn(uuid,bigint,text,jsonb,uuid),public.async_promote_timeouts(uuid) from public;
grant execute on function public.async_start_turn(uuid,bigint,jsonb,uuid),public.async_finish_turn(uuid,bigint,text,jsonb,uuid),public.async_promote_timeouts(uuid) to authenticated;
