-- Liga de los Mundos v0.6.35-v02
-- Migración de PRUEBA para la preparación 1v1 online.
-- Ejecutar UNA sola vez en Supabase > SQL Editor.

alter table public.online_slots
  add column if not exists champion_id text;

alter table public.online_slots
  add column if not exists loadout jsonb not null default '[]'::jsonb;

-- El cliente de prueba necesita poder actualizar SU slot para guardar
-- campeón, loadout y LISTO. Esta policy es deliberadamente permisiva
-- para el MVP; NO es la política final de producción.
grant select, insert, update, delete on table public.online_slots to anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname='public'
      and tablename='online_slots'
      and policyname='online_slots_update_mvp_test'
  ) then
    create policy online_slots_update_mvp_test
      on public.online_slots
      for update
      to anon, authenticated
      using (true)
      with check (true);
  end if;
end $$;
