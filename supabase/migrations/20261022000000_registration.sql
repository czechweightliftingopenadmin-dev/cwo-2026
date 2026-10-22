-- CWO 2026 registrations. Apply with `supabase db push`, or paste into the SQL editor once.
-- The browser never talks to the database: only the API in api/ uses the secret key.
-- Every write is recorded in audit_log, so any mistake can be undone (docs/registrace.md).

create extension if not exists pg_cron with schema pg_catalog;

-- Tables ---------------------------------------------------------------------

create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('individual', 'team')),
  invoice_number text check (invoice_number ~ '^\d{8}$'),
  access_code text not null unique check (access_code ~ '^(CW|AM)-[A-Z2-9]{4}-[A-Z2-9]{4}$'),
  team_name text,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  language text not null default 'cs' check (language in ('cs', 'en')),
  consent_at timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'team') = (team_name is not null))
);
comment on column public.registrations.status is 'Cancel with status = cancelled instead of deleting.';
comment on column public.registrations.note is 'Internal note for organisers.';

-- One active registration per invoice; a cancelled one frees the number.
create unique index registrations_invoice_active_key
  on public.registrations (invoice_number) where status = 'active';

create table public.athletes (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations (id) on delete cascade,
  position smallint not null,
  first_name text not null,
  last_name text not null,
  birth_date date not null,
  sex text not null check (sex in ('M', 'F')),
  weight_class text not null,
  total integer not null check (total between 0 and 500),
  email text not null check (email = lower(btrim(email))),
  phone text not null,
  tshirt_size text check (tshirt_size in ('XS', 'S', 'M', 'L', 'XL', 'XXL')),
  cwo boolean not null,
  amcr boolean not null,
  university text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (registration_id, position),
  check (amcr = false or university is not null)
);
create index athletes_email_idx on public.athletes (email);

create table public.audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  row_id uuid not null,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  source text not null,
  changed_at timestamptz not null default now()
);
create index audit_log_row_id_idx on public.audit_log (row_id);

create table public.email_log (
  id bigint generated always as identity primary key,
  registration_id uuid references public.registrations (id) on delete set null,
  kind text not null check (kind in ('registration', 'update')),
  recipients text[] not null,
  status text not null check (status in ('sent', 'failed')),
  provider_id text,
  error text,
  created_at timestamptz not null default now()
);

create table public.lookup_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  attempted_at timestamptz not null default now()
);
create index lookup_attempts_ip_hash_idx on public.lookup_attempts (ip_hash, attempted_at);

create table public.startlist_snapshots (
  id bigint generated always as identity primary key,
  published_at timestamptz not null default now(),
  is_final boolean not null default false,
  data jsonb not null
);

-- Triggers -------------------------------------------------------------------

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- The API marks its writes with set_config('cwo.source', 'api', true); anything
-- else (the Table Editor, the SQL editor) is recorded as 'dashboard'.
create function public.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_log (table_name, row_id, action, old_data, new_data, source)
  values (
    tg_table_name,
    case when tg_op = 'DELETE' then old.id else new.id end,
    tg_op,
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end,
    coalesce(nullif(current_setting('cwo.source', true), ''), 'dashboard')
  );
  return null;
end;
$$;

create trigger registrations_touch before update on public.registrations
  for each row execute function public.touch_updated_at();
create trigger athletes_touch before update on public.athletes
  for each row execute function public.touch_updated_at();
create trigger registrations_audit after insert or update or delete on public.registrations
  for each row execute function public.audit_row();
create trigger athletes_audit after insert or update or delete on public.athletes
  for each row execute function public.audit_row();

-- API functions ----------------------------------------------------------------

-- Creates a registration with all its athletes in one transaction.
create function public.create_registration(p_registration jsonb, p_athletes jsonb) returns uuid
language plpgsql set search_path = '' as $$
declare
  new_id uuid;
begin
  perform set_config('cwo.source', 'api', true);
  insert into public.registrations (kind, invoice_number, access_code, team_name, language)
  values (
    p_registration ->> 'kind',
    p_registration ->> 'invoiceNumber',
    p_registration ->> 'accessCode',
    p_registration ->> 'teamName',
    p_registration ->> 'language'
  )
  returning id into new_id;

  insert into public.athletes (
    registration_id, position, first_name, last_name, birth_date, sex, weight_class, total,
    email, phone, tshirt_size, cwo, amcr, university
  )
  select
    new_id,
    item.ordinality,
    item.value ->> 'firstName',
    item.value ->> 'lastName',
    (item.value ->> 'birthDate')::date,
    item.value ->> 'sex',
    item.value ->> 'weightClass',
    (item.value ->> 'total')::integer,
    item.value ->> 'email',
    item.value ->> 'phone',
    item.value ->> 'tshirtSize',
    (item.value ->> 'cwo')::boolean,
    (item.value ->> 'amcr')::boolean,
    item.value ->> 'university'
  from jsonb_array_elements(p_athletes) with ordinality as item;

  return new_id;
end;
$$;

-- Returns the active registration when the e-mail belongs to one of its athletes.
create function public.find_registration(p_invoice text, p_code text, p_email text) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', r.id,
    'kind', r.kind,
    'teamName', r.team_name,
    'invoiceNumber', r.invoice_number,
    'accessCode', r.access_code,
    'athletes', (
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'firstName', a.first_name,
        'lastName', a.last_name,
        'sex', a.sex,
        'weightClass', a.weight_class,
        'total', a.total,
        'email', a.email
      ) order by a.position)
      from public.athletes a
      where a.registration_id = r.id
    )
  )
  from public.registrations r
  where r.status = 'active'
    and (r.invoice_number = p_invoice or r.access_code = p_code)
    and exists (
      select 1 from public.athletes a
      where a.registration_id = r.id and a.email = lower(btrim(p_email))
    );
$$;

-- Changes only the bodyweight category and total. Returns the number of changed athletes.
create function public.update_athlete_results(p_registration_id uuid, p_changes jsonb)
returns integer
language plpgsql set search_path = '' as $$
declare
  changed integer;
begin
  perform set_config('cwo.source', 'api', true);
  update public.athletes a
  set weight_class = c.weight_class, total = c.total
  from jsonb_to_recordset(p_changes) as c (id uuid, weight_class text, total integer)
  where a.id = c.id
    and a.registration_id = p_registration_id
    and (a.weight_class, a.total) is distinct from (c.weight_class, c.total);
  get diagnostics changed = row_count;
  return changed;
end;
$$;

-- Records a lookup and returns the number of attempts from the same address in 15 minutes.
create function public.record_lookup_attempt(p_ip_hash text) returns integer
language plpgsql set search_path = '' as $$
declare
  attempts integer;
begin
  delete from public.lookup_attempts where attempted_at < now() - interval '1 day';
  insert into public.lookup_attempts (ip_hash) values (p_ip_hash);
  select count(*) into attempts from public.lookup_attempts
  where ip_hash = p_ip_hash and attempted_at > now() - interval '15 minutes';
  return attempts;
end;
$$;

-- Start list -------------------------------------------------------------------

create view public.public_startlist with (security_invoker = true) as
select
  r.kind,
  r.team_name,
  a.first_name,
  a.last_name,
  extract(year from a.birth_date)::integer as birth_year,
  a.sex,
  a.weight_class,
  a.total,
  a.cwo,
  a.amcr,
  a.university
from public.athletes a
join public.registrations r on r.id = a.registration_id
where r.status = 'active';

-- Everything organisers need in one table; export it as CSV from the Table Editor.
create view public.registrations_overview with (security_invoker = true) as
select
  r.invoice_number,
  r.access_code,
  r.kind,
  r.team_name,
  a.position,
  a.first_name,
  a.last_name,
  a.birth_date,
  a.sex,
  a.weight_class,
  a.total,
  a.email,
  a.phone,
  a.tshirt_size,
  a.cwo,
  a.amcr,
  a.university,
  r.status,
  r.note,
  r.created_at,
  greatest(r.updated_at, a.updated_at) as updated_at
from public.registrations r
join public.athletes a on a.registration_id = r.id
order by r.created_at, a.position;

create function public.publish_startlist_snapshot(p_final boolean default false) returns bigint
language sql set search_path = '' as $$
  insert into public.startlist_snapshots (is_final, data)
  select p_final, coalesce(jsonb_agg(jsonb_build_object(
    'kind', s.kind,
    'teamName', s.team_name,
    'firstName', s.first_name,
    'lastName', s.last_name,
    'birthYear', s.birth_year,
    'sex', s.sex,
    'weightClass', s.weight_class,
    'total', s.total,
    'cwo', s.cwo,
    'amcr', s.amcr,
    'university', s.university
  ) order by s.last_name, s.first_name), '[]'::jsonb)
  from public.public_startlist s
  returning id;
$$;

-- 23:59 Prague time (22:59 UTC in December) from 6 to 16 December. The snapshot from
-- 6 December is the first start list on 7 December; the one from 16 December is final
-- on 17 December. Publish manually at any time with select publish_startlist_snapshot();
select cron.schedule(
  'cwo-startlist',
  '59 22 6-16 12 *',
  $$select public.publish_startlist_snapshot(
    (now() at time zone 'Europe/Prague')::date >= date '2026-12-16'
  )$$
);

-- Restore ------------------------------------------------------------------------

-- Puts back the state a row had before the audited change. Restore a deleted
-- registration before its athletes.
create function public.restore_from_audit(p_entry_id bigint) returns void
language plpgsql set search_path = '' as $$
declare
  entry public.audit_log;
begin
  select * into entry from public.audit_log where id = p_entry_id;
  if entry.id is null then
    raise exception 'Audit entry % does not exist', p_entry_id;
  end if;
  if entry.old_data is null then
    raise exception 'Audit entry % is an INSERT; cancel the registration instead', p_entry_id;
  end if;
  perform set_config('cwo.source', format('restore:%s', p_entry_id), true);

  if entry.table_name = 'registrations' then
    insert into public.registrations
    select * from jsonb_populate_record(null::public.registrations, entry.old_data)
    on conflict (id) do update set
      kind = excluded.kind,
      invoice_number = excluded.invoice_number,
      access_code = excluded.access_code,
      team_name = excluded.team_name,
      status = excluded.status,
      language = excluded.language,
      consent_at = excluded.consent_at,
      note = excluded.note;
  elsif entry.table_name = 'athletes' then
    insert into public.athletes
    select * from jsonb_populate_record(null::public.athletes, entry.old_data)
    on conflict (id) do update set
      registration_id = excluded.registration_id,
      position = excluded.position,
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      birth_date = excluded.birth_date,
      sex = excluded.sex,
      weight_class = excluded.weight_class,
      total = excluded.total,
      email = excluded.email,
      phone = excluded.phone,
      tshirt_size = excluded.tshirt_size,
      cwo = excluded.cwo,
      amcr = excluded.amcr,
      university = excluded.university;
  else
    raise exception 'Unknown table %', entry.table_name;
  end if;
end;
$$;

-- Access ---------------------------------------------------------------------------

-- Supabase grants new objects to anon and authenticated by default. Remove that,
-- so only the secret key (service_role) used by the API can read or write.
alter table public.registrations enable row level security;
alter table public.athletes enable row level security;
alter table public.audit_log enable row level security;
alter table public.email_log enable row level security;
alter table public.lookup_attempts enable row level security;
alter table public.startlist_snapshots enable row level security;

revoke all on
  public.registrations,
  public.athletes,
  public.audit_log,
  public.email_log,
  public.lookup_attempts,
  public.startlist_snapshots,
  public.public_startlist,
  public.registrations_overview
from anon, authenticated;

revoke execute on function
  public.create_registration(jsonb, jsonb),
  public.find_registration(text, text, text),
  public.update_athlete_results(uuid, jsonb),
  public.record_lookup_attempt(text),
  public.publish_startlist_snapshot(boolean),
  public.restore_from_audit(bigint),
  public.audit_row(),
  public.touch_updated_at()
from public, anon, authenticated;

-- The API's secret key acts as service_role. Grant it explicitly, so the migration also
-- works with "Automatically expose new tables" switched off in the project settings.
grant usage on schema public to service_role;
grant select, insert, update, delete on
  public.registrations,
  public.athletes,
  public.email_log,
  public.lookup_attempts,
  public.startlist_snapshots
to service_role;
grant select on public.audit_log, public.public_startlist, public.registrations_overview
to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on function
  public.create_registration(jsonb, jsonb),
  public.find_registration(text, text, text),
  public.update_athlete_results(uuid, jsonb),
  public.record_lookup_attempt(text),
  public.publish_startlist_snapshot(boolean)
to service_role;
