\set ON_ERROR_STOP on
-- These assertions fail on unexpected acceptance; they do not catch their own assertions.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'live_v2_%'
  loop
    if has_function_privilege('anon',f.sig,'execute') or has_function_privilege('authenticated',f.sig,'execute') then
      raise exception 'client privilege leak: %',f.sig;
    end if;
    if not has_function_privilege('service_role',f.sig,'execute') then raise exception 'backend grant missing: %',f.sig; end if;
  end loop;
end $$;
set role anon;
do $$ declare denied boolean:=false; begin
  begin perform public.live_v2_backend_match('10000000-0000-0000-0000-000000000001');
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'anonymous backend read accepted'; end if;
end $$;
reset role;

-- Exercise the SQL rejection directly and assert its SQLSTATE, not a mocked adapter.
begin;
do $$ declare
  actor uuid := gen_random_uuid(); match uuid := gen_random_uuid();
  rejected boolean := false;
begin
  perform public.live_v2_create_room(actor,match);
  begin
    perform public.live_v2_confirm_command(actor,match,gen_random_uuid(),'stale',99,0,
      'preparation','preparation',0,null,'{}'::jsonb,'{}'::jsonb,'hash',false);
  exception when others then
    if sqlstate <> 'P0001' or sqlerrm <> 'VERSION_CONFLICT' then
      raise exception 'Unexpected CAS rejection: % %',sqlstate,sqlerrm;
    end if;
    rejected := true;
  end;
  if not rejected then raise exception 'Stale version accepted'; end if;
end $$;
rollback;
