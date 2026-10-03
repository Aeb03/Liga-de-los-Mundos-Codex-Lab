\set ON_ERROR_STOP on
select set_config('request.jwt.claim.role','service_role',false);
select public.live_v2_create_room('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
select public.live_v2_join_room('00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','B1');
do $$begin
 if (select count(*) from live_v2.members)<>2 then raise exception 'members';end if;
 begin perform public.live_v2_join_room('00000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','B1');raise exception 'slot appropriation accepted';exception when others then null;end;
 update live_v2.matches set phase='deployment',state=jsonb_set(jsonb_set(state,'{phase}','"deployment"'),'{slots,B1,position}','{"x":11,"y":3}');
 if public.live_v2_snapshot('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001')#>>'{slots,B1,position}' is not null then raise exception 'position leak';end if;
end$$;
select public.live_v2_reject_command('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','f',0,null,'FORBIDDEN',false);
do $$declare r jsonb;begin r=public.live_v2_recover_command('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001');if r->>'status'<>'rejected'then raise exception'rejection lost';end if;r=public.live_v2_recover_command('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000099');if r->>'status'<>'not_registered'then raise exception'missing contract';end if;end$$;
do $$begin if has_function_privilege('anon','public.live_v2_backend_match(uuid)','execute')or has_function_privilege('authenticated','public.live_v2_prepare_command(uuid,uuid,uuid,text,boolean)','execute')or has_function_privilege('anon','public.live_v2_create_room(uuid,uuid)','execute')or has_function_privilege('authenticated','public.live_v2_reject_command(uuid,uuid,uuid,text,bigint,bigint,text,boolean)','execute')then raise exception'client privilege leak';end if;end$$;
-- CAS behavior: exactly one of two confirmations at version 0 can commit.
update live_v2.matches set phase='preparation',state=jsonb_set(state,'{phase}','"preparation"'),version=0;
