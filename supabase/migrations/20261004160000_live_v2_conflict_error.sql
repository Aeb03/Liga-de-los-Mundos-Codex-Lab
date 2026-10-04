-- VERSION_CONFLICT is an application CAS rejection, not a transient serialization failure.
-- PostgREST 14 retries SQLSTATE 40001 indefinitely. Preserve the existing function,
-- its signature, SECURITY DEFINER, search_path and grants; change only this raise.
do $migration$
declare
  signature regprocedure := 'public.live_v2_confirm_command(uuid,uuid,uuid,text,bigint,bigint,text,text,bigint,bigint,jsonb,jsonb,text,boolean)'::regprocedure;
  definition text;
  old_raise text := 'raise exception ''VERSION_CONFLICT'' using errcode=''40001'';';
  new_raise text := 'raise exception ''VERSION_CONFLICT'';';
begin
  definition := pg_get_functiondef(signature);
  if strpos(definition, old_raise) > 0 then
    execute replace(definition, old_raise, new_raise);
  elsif strpos(definition, new_raise) = 0 then
    raise exception 'Unexpected live_v2_confirm_command definition';
  end if;
end $migration$;
