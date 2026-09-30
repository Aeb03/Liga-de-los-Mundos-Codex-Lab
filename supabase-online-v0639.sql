-- Liga de los Mundos v0.6.39-v02
-- BLOQUE ONLINE: primera habilidad sincronizada (Arfeli — Corte con Espada).
-- Ejecutar UNA sola vez en Supabase SQL Editor.
-- No crea tablas nuevas ni modifica URL, Publishable Key, RLS o Realtime.

alter table public.online_actions
  drop constraint if exists online_actions_action_type_value;

alter table public.online_actions
  add constraint online_actions_action_type_value
  check (action_type in ('move','end_turn','ability'));
