-- Liga de los Mundos v0.6.37-v02
-- BLOQUE ONLINE: autoridad de turno sincronizada.
-- Ejecutar UNA sola vez en Supabase SQL Editor.
-- No toca URL, keys, RLS ni Realtime.

alter table public.online_matches
  add column if not exists round_number smallint not null default 1;

alter table public.online_matches
  add column if not exists turn_index smallint not null default 0;

alter table public.online_matches
  add column if not exists turn_seq bigint not null default 0;

alter table public.online_matches
  add column if not exists active_team text;

alter table public.online_matches
  add column if not exists active_slot smallint;

alter table public.online_matches
  add column if not exists turn_started_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='online_matches_round_number_range'
      and conrelid='public.online_matches'::regclass
  ) then
    alter table public.online_matches
      add constraint online_matches_round_number_range
      check (round_number >= 1);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname='online_matches_turn_index_range'
      and conrelid='public.online_matches'::regclass
  ) then
    alter table public.online_matches
      add constraint online_matches_turn_index_range
      check (turn_index >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname='online_matches_turn_seq_range'
      and conrelid='public.online_matches'::regclass
  ) then
    alter table public.online_matches
      add constraint online_matches_turn_seq_range
      check (turn_seq >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname='online_matches_active_team_value'
      and conrelid='public.online_matches'::regclass
  ) then
    alter table public.online_matches
      add constraint online_matches_active_team_value
      check (active_team is null or active_team in ('A','B'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname='online_matches_active_slot_range'
      and conrelid='public.online_matches'::regclass
  ) then
    alter table public.online_matches
      add constraint online_matches_active_slot_range
      check (active_slot is null or (active_slot between 1 and 5));
  end if;
end $$;
