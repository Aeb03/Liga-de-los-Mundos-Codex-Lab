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
