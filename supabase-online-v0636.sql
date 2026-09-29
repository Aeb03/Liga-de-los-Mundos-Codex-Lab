-- Liga de los Mundos v0.6.36-v02
-- Migración EXPERIMENTAL: despliegue online sincronizado 1v1.
-- Ejecutar UNA sola vez en Supabase > SQL Editor.
-- No modifica URL, Publishable Key, Realtime ni las policies ya validadas.

alter table public.online_slots
  add column if not exists deploy_x smallint;

alter table public.online_slots
  add column if not exists deploy_y smallint;

alter table public.online_slots
  add column if not exists deployment_ready boolean not null default false;

-- Coordenadas canónicas del tablero 12x12. NULL = todavía no desplegado.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='online_slots_deploy_x_range'
      and conrelid='public.online_slots'::regclass
  ) then
    alter table public.online_slots
      add constraint online_slots_deploy_x_range
      check (deploy_x is null or (deploy_x between 0 and 11));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname='online_slots_deploy_y_range'
      and conrelid='public.online_slots'::regclass
  ) then
    alter table public.online_slots
      add constraint online_slots_deploy_y_range
      check (deploy_y is null or (deploy_y between 0 and 11));
  end if;
end $$;

-- La policy UPDATE permisiva del MVP ya fue creada en v0.6.35.
-- No se crean nuevas policies ni se amplían permisos aquí.
