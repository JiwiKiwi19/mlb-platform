-- Core schema for the live pitch pipeline.
--
-- Access model:
--   * The streaming consumer writes with the service_role key, which bypasses RLS.
--   * The browser uses the anon key and may only SELECT (needed for Realtime).
--   * No write policies exist for anon/authenticated, so all client writes are denied.
--
-- Idempotent: safe to run against a project that already has live_pitches.

-- ---------------------------------------------------------------------------
-- live_pitches
-- ---------------------------------------------------------------------------
create table if not exists public.live_pitches (
  id                  bigserial primary key,
  game_id             integer,
  unique_id           text not null unique,
  pitch_type          text,
  speed_mph           double precision,
  zone_x              double precision,
  zone_z              double precision,
  zone_eval           text,
  pitcher_id          text,
  pitcher_full_name   text,
  pitcher_first_name  text,
  pitcher_last_name   text,
  pitcher_team        text,
  inning              smallint,
  schema_version      smallint not null default 1,
  "timestamp"         timestamptz,
  created_at          timestamptz not null default now()
);

alter table public.live_pitches add column if not exists inning smallint;
alter table public.live_pitches add column if not exists schema_version smallint not null default 1;

create index if not exists live_pitches_created_at_idx
  on public.live_pitches (created_at desc);
create index if not exists live_pitches_pitcher_type_idx
  on public.live_pitches (pitcher_id, pitch_type, created_at desc);

-- ---------------------------------------------------------------------------
-- pitch_alerts
-- ---------------------------------------------------------------------------
create table if not exists public.pitch_alerts (
  id                bigserial primary key,
  unique_id         text not null unique,
  pitch_unique_id   text references public.live_pitches (unique_id) on delete cascade,
  game_id           integer,
  pitcher_id        text not null,
  pitcher_name      text,
  team              text,
  pitch_type        text,
  alert_type        text not null,
  message           text not null,
  severity          text not null check (severity in ('info', 'warning', 'critical')),
  baseline_mph      double precision,
  recent_mph        double precision,
  delta_mph         double precision,
  created_at        timestamptz not null default now()
);

-- Projects that created pitch_alerts by hand for the pre-v1 consumer lack these.
alter table public.pitch_alerts add column if not exists game_id integer;
alter table public.pitch_alerts add column if not exists pitch_type text;
alter table public.pitch_alerts add column if not exists baseline_mph double precision;
alter table public.pitch_alerts add column if not exists recent_mph double precision;
alter table public.pitch_alerts add column if not exists delta_mph double precision;

create index if not exists pitch_alerts_created_at_idx
  on public.pitch_alerts (created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security: read-only for clients
-- ---------------------------------------------------------------------------
alter table public.live_pitches enable row level security;
alter table public.pitch_alerts enable row level security;

drop policy if exists "Public read access" on public.live_pitches;
create policy "Public read access" on public.live_pitches
  for select to anon, authenticated using (true);

drop policy if exists "Public read access" on public.pitch_alerts;
create policy "Public read access" on public.pitch_alerts
  for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['live_pitches', 'pitch_alerts'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$$;
