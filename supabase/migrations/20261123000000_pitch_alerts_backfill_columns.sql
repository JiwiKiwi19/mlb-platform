-- pitch_alerts tables created by hand for the pre-v1 consumer can lack `severity`
-- (the consumer writes it on every alert) and `id` (the dashboard orders alerts by it).
-- `create table if not exists` in the init migration skips existing tables, so add them here.

alter table public.pitch_alerts add column if not exists severity text not null default 'warning';
alter table public.pitch_alerts add column if not exists id bigserial;

create unique index if not exists pitch_alerts_id_key on public.pitch_alerts (id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.pitch_alerts'::regclass and conname = 'pitch_alerts_severity_check'
  ) then
    alter table public.pitch_alerts
      add constraint pitch_alerts_severity_check check (severity in ('info', 'warning', 'critical'));
  end if;
end $$;

-- Some hand-made tables typed unique_id as uuid, but alert IDs are "fatigue:<pitch unique_id>".
alter table public.pitch_alerts alter column unique_id drop default;
alter table public.pitch_alerts alter column unique_id type text using unique_id::text;

-- PostgREST caches the schema; reload it so the API sees the new columns immediately.
notify pgrst, 'reload schema';
