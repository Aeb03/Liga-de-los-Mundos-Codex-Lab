create extension if not exists pgcrypto;

create table public.async_matches (
  id uuid primary key default gen_random_uuid(),
  room_code text not null unique,
  status text not null default 'forming' check (status in ('forming','waiting','active','finished','expired')),
  snapshot jsonb,
  snapshot_hash text,
  timeout_snapshot jsonb,
  timeout_snapshot_hash text,
  state_version bigint not null default 0,
  round_number integer not null default 1,
  turn_sequence bigint not null default 0,
  active_member_id uuid,
  turn_started_at timestamptz,
  turn_deadline timestamptz,
  waiting_deadline timestamptz not null default (clock_timestamp()+interval '12 hours'),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

create table public.async_members (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.async_matches(id) on delete cascade,
  user_id uuid not null,
  team text not null check (team in ('A','B')),
  slot_number integer not null default 1 check (slot_number>0),
  turn_position integer not null check (turn_position>0),
  champion_id text,
  loadout jsonb not null default '[]'::jsonb,
  deploy_x integer check (deploy_x between 0 and 11),
  deploy_y integer check (deploy_y between 0 and 11),
  ready boolean not null default false,
  joined_at timestamptz not null default clock_timestamp(),
  unique(match_id,user_id), unique(match_id,team,slot_number), unique(match_id,turn_position)
);

alter table public.async_matches add constraint async_matches_active_member_fk foreign key(active_member_id) references public.async_members(id) on delete set null;

create table public.async_requests (
  user_id uuid not null,
  request_id uuid not null,
  operation text not null,
  response jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key(user_id,request_id)
);

create table public.async_audit (
  id bigint generated always as identity primary key,
  match_id uuid references public.async_matches(id) on delete cascade,
  user_id uuid,
  operation text not null,
  state_version bigint,
  payload jsonb,
  created_at timestamptz not null default clock_timestamp()
);

create index async_members_user_idx on public.async_members(user_id);
create index async_members_match_idx on public.async_members(match_id);
create index async_matches_active_idx on public.async_matches(active_member_id,status);

alter table public.async_matches enable row level security;
alter table public.async_members enable row level security;
alter table public.async_requests enable row level security;
alter table public.async_audit enable row level security;

create or replace function public.async_is_member(p_match uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$select exists(select 1 from public.async_members where match_id=p_match and user_id=auth.uid())$$;
revoke all on function public.async_is_member(uuid) from public;
grant execute on function public.async_is_member(uuid) to authenticated;

create policy async_matches_read on public.async_matches for select to authenticated using (public.async_is_member(id));
create policy async_members_read on public.async_members for select to authenticated using (public.async_is_member(match_id));

revoke insert,update,delete on public.async_matches from anon,authenticated;
revoke insert,update,delete on public.async_members from anon,authenticated;
revoke all on public.async_requests from anon,authenticated;
revoke all on public.async_audit from anon,authenticated;
grant select on public.async_matches,public.async_members to authenticated;

create or replace function public.async_hash(v jsonb) returns text language sql immutable as $$select encode(digest(convert_to(v::text,'UTF8'),'sha256'),'hex')$$;
create or replace function public.async_snapshot_valid(v jsonb) returns boolean language sql immutable as $$select v is not null and v->>'schema'='ldm.combat.snapshot' and coalesce((v->>'schemaVersion')::int,0)=1 and jsonb_typeof(v->'battle')='object'$$;
