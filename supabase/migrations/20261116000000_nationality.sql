-- Nationality of every athlete, and a weight class overview for organisers.
-- Backwards compatible: the column is optional, so the API deployed before this
-- migration keeps working. The form requires it for new registrations; athletes
-- registered earlier keep it empty until organisers fill it in by hand.

alter table public.athletes add column nationality text check (nationality ~ '^[A-Z]{3}$');
comment on column public.athletes.nationality is
  'Three-letter country code in capitals: CZE, SVK, POL, AUT, DEU… (ISO 3166-1 alpha-3). Empty only for registrations made before 16 November 2026.';

create or replace function public.create_registration(
  p_registration jsonb,
  p_athletes jsonb,
  p_invoice_limit integer
) returns uuid
language plpgsql set search_path = '' as $$
declare
  new_id uuid;
  invoice text := p_registration ->> 'invoiceNumber';
  registered integer;
begin
  perform set_config('cwo.source', 'api', true);

  if invoice is not null then
    -- Serialise registrations on one invoice, so two at once cannot both pass the checks.
    perform pg_advisory_xact_lock(hashtext('cwo-invoice:' || invoice));

    select count(*) into registered
    from public.athletes a
    join public.registrations r on r.id = a.registration_id
    where r.status = 'active' and r.invoice_number = invoice;
    if registered + jsonb_array_length(p_athletes) > p_invoice_limit then
      raise exception 'Invoice % would exceed % people', invoice, p_invoice_limit
        using errcode = 'CW001';
    end if;

    if exists (
      select 1
      from public.athletes a
      join public.registrations r on r.id = a.registration_id
      join jsonb_array_elements(p_athletes) as item on true
      where r.status = 'active'
        and r.invoice_number = invoice
        and (
          a.email = lower(btrim(item.value ->> 'email'))
          or (
            lower(a.first_name) = lower(btrim(item.value ->> 'firstName'))
            and lower(a.last_name) = lower(btrim(item.value ->> 'lastName'))
            and a.birth_date = (item.value ->> 'birthDate')::date
          )
        )
    ) then
      raise exception 'Athlete already registered on invoice %', invoice using errcode = 'CW002';
    end if;
  end if;

  insert into public.registrations (kind, invoice_number, access_code, team_name, language)
  values (
    p_registration ->> 'kind',
    invoice,
    p_registration ->> 'accessCode',
    p_registration ->> 'teamName',
    p_registration ->> 'language'
  )
  returning id into new_id;

  insert into public.athletes (
    registration_id, position, first_name, last_name, birth_date, sex, nationality,
    weight_class, total, email, phone, tshirt_size, cwo, amcr, university
  )
  select
    new_id,
    item.ordinality,
    item.value ->> 'firstName',
    item.value ->> 'lastName',
    (item.value ->> 'birthDate')::date,
    item.value ->> 'sex',
    item.value ->> 'nationality',
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

-- Restores the nationality too. Entries saved before this migration do not know it,
-- so restoring them keeps the nationality an organiser has filled in since.
create or replace function public.restore_from_audit(p_entry_id bigint) returns void
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
      nationality = case when entry.old_data ? 'nationality'
        then excluded.nationality else athletes.nationality end,
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

-- Start list ---------------------------------------------------------------------

-- A replaced view may only gain columns at the end.
create or replace view public.public_startlist with (security_invoker = true) as
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
  a.university,
  a.nationality
from public.athletes a
join public.registrations r on r.id = a.registration_id
where r.status = 'active';

create or replace function public.publish_startlist_snapshot(p_final boolean default false)
returns bigint
language sql set search_path = '' as $$
  insert into public.startlist_snapshots (is_final, data)
  select p_final, coalesce(jsonb_agg(jsonb_build_object(
    'kind', s.kind,
    'teamName', s.team_name,
    'firstName', s.first_name,
    'lastName', s.last_name,
    'birthYear', s.birth_year,
    'sex', s.sex,
    'nationality', s.nationality,
    'weightClass', s.weight_class,
    'total', s.total,
    'cwo', s.cwo,
    'amcr', s.amcr,
    'university', s.university
  ) order by s.last_name, s.first_name), '[]'::jsonb)
  from public.public_startlist s
  returning id;
$$;

-- Organisers -----------------------------------------------------------------------

-- Recreated, so the nationality sits next to the other personal details in the export.
drop view public.registrations_overview;
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
  a.nationality,
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

-- How many people are registered in each weight class, live, before the start list is
-- published. Read-only, for planning the schedule: open it in the Table Editor.
-- Team members count in their weight class, like on the start list.
create view public.prehled_vahovek with (security_invoker = true) as
select
  case s.sex when 'F' then 'Ženy' else 'Muži' end as pohlavi,
  s.weight_class as vahovka,
  count(*)::integer as celkem,
  (count(*) filter (where s.cwo))::integer as cwo,
  (count(*) filter (where s.amcr))::integer as amcr
from public.public_startlist s
group by s.sex, s.weight_class
order by s.sex, regexp_replace(s.weight_class, '\D', '', 'g')::integer, s.weight_class like '+%';

revoke all on public.registrations_overview, public.prehled_vahovek from anon, authenticated;
grant select on public.registrations_overview, public.prehled_vahovek to service_role;
