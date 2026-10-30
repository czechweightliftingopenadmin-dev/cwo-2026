-- An athlete has one active registration, independently of the invoice or competitions.
-- Never silently merge existing people: stop the migration for an organiser to review
-- any pre-existing exact identity duplicates before the unique index is installed.
create function public.registration_name(value text) returns text
language sql immutable strict set search_path = '' as $$
  select lower(btrim(regexp_replace(normalize(value, NFC), '[[:space:]]+', ' ', 'g')));
$$;

do $$
begin
  if exists (
    select 1 from public.athletes a
    join public.registrations r on r.id = a.registration_id
    where r.status = 'active'
    group by public.registration_name(a.first_name), public.registration_name(a.last_name),
      a.birth_date, lower(btrim(a.email))
    having count(*) > 1
  ) then
    raise exception 'Duplicate active athletes exist. Review identities before applying registration_changes; no records have been merged.';
  end if;
end;
$$;

-- A partial unique index cannot join registrations. Keep this derived flag in sync
-- using triggers, including dashboard changes, cancellation and audit restores.
-- False is also safe while restoring a legacy backup with triggers temporarily off;
-- restore.sh derives the real flags before that transaction commits.
alter table public.athletes add column registration_active boolean not null default false;
update public.athletes a set registration_active = (r.status = 'active')
from public.registrations r where r.id = a.registration_id;

create function public.set_athlete_registration_active() returns trigger
language plpgsql set search_path = '' as $$
begin
  select r.status = 'active' into new.registration_active
  from public.registrations r where r.id = new.registration_id for share;
  return new;
end;
$$;
create trigger athlete_registration_active
before insert or update of registration_id, registration_active on public.athletes
for each row execute function public.set_athlete_registration_active();

create function public.sync_registration_active() returns trigger
language plpgsql set search_path = '' as $$
begin
  update public.athletes set registration_active = (new.status = 'active')
  where registration_id = new.id;
  return new;
end;
$$;
create trigger registration_active
after update of status on public.registrations
for each row when (old.status is distinct from new.status)
execute function public.sync_registration_active();

-- The index also serialises simultaneous inserts of the same person. A conflict
-- rolls back the entire registration, including teammates and the audit records.
create unique index athletes_active_identity_key on public.athletes (
  public.registration_name(first_name), public.registration_name(last_name),
  birth_date, lower(btrim(email))
) where registration_active;

create function public.athlete_details(a public.athletes) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'id', a.id, 'firstName', a.first_name, 'lastName', a.last_name, 'sex', a.sex,
    'weightClass', a.weight_class, 'total', a.total, 'email', a.email,
    'cwo', a.cwo, 'amcr', a.amcr, 'university', a.university, 'tshirtSize', a.tshirt_size
  );
$$;

create function public.registration_details(registration_id uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', r.id, 'kind', r.kind, 'teamName', r.team_name, 'invoiceNumber', r.invoice_number,
    'accessCode', r.access_code,
    'athletes', (select jsonb_agg(public.athlete_details(a) order by a.position)
      from public.athletes a where a.registration_id = r.id)
  ) from public.registrations r where r.id = registration_id;
$$;

create or replace function public.find_registrations(p_invoice text, p_code text, p_email text)
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(public.registration_details(r.id) order by r.created_at), '[]'::jsonb)
  from public.registrations r
  where r.status = 'active'
    and (r.invoice_number = p_invoice or r.access_code = p_code)
    and exists (select 1 from public.athletes a
      where a.registration_id = r.id and a.email = lower(btrim(p_email)));
$$;

-- Apply the entire request atomically. Recheck ownership, current participation and
-- invoice capacity after locking, rather than trusting an earlier browser lookup.
-- CW001 invoice full, CW003 not found, CW004 stale/invalid transition,
-- CW005 results closed, CW006 competition/details changes closed.
create function public.apply_registration_changes(
  p_invoice text, p_code text, p_email text, p_changes jsonb,
  p_results_open boolean, p_competitions_open boolean, p_invoice_limit integer
) returns jsonb language plpgsql set search_path = '' as $$
declare
  r public.registrations;
  before_athlete public.athletes;
  after_athlete public.athletes;
  item jsonb;
  new_invoice text;
  changes jsonb;
  groups jsonb := '[]'::jsonb;
  changed integer := 0;
  permitted integer;
  expected integer;
  registered integer;
  registration_ids uuid[];
begin
  perform set_config('cwo.source', 'api', true);
  if jsonb_typeof(p_changes) is distinct from 'array' then
    raise exception 'Invalid changes' using errcode = 'CW004';
  end if;
  expected := jsonb_array_length(p_changes);
  if expected < 1 or expected > 4 or
    (select count(distinct value ->> 'athleteId') from jsonb_array_elements(p_changes)) <> expected
    or (p_invoice is null) = (p_code is null) then
    raise exception 'Invalid changes' using errcode = 'CW004';
  end if;

  -- Same lock as create_registration, always before row locks. Sorted so requests
  -- sharing several invoices cannot deadlock by taking them in opposite orders.
  for new_invoice in
    select distinct value -> 'addCwo' ->> 'invoiceNumber'
    from jsonb_array_elements(p_changes) where value ? 'addCwo'
    order by 1
  loop
    perform pg_advisory_xact_lock(hashtext('cwo-invoice:' || new_invoice));
  end loop;

  -- Only registrations actually addressed by this request are locked.
  for r in
    select reg.* from public.registrations reg
    where reg.status = 'active'
      and (reg.invoice_number = p_invoice or reg.access_code = p_code)
      and exists (select 1 from public.athletes a
        where a.registration_id = reg.id and a.email = lower(btrim(p_email)))
      and exists (select 1 from public.athletes a join jsonb_array_elements(p_changes) c
        on a.id = (c.value ->> 'athleteId')::uuid where a.registration_id = reg.id)
    order by reg.id for update
  loop
    registration_ids := array_append(registration_ids, r.id);
  end loop;

  select count(*) into permitted from public.athletes a
  join jsonb_array_elements(p_changes) c on a.id = (c.value ->> 'athleteId')::uuid
  where a.registration_id = any(registration_ids);
  if permitted <> expected then
    raise exception 'Registration not found' using errcode = 'CW003';
  end if;

  for r in select * from public.registrations where id = any(registration_ids) order by id
  loop
    changes := '[]'::jsonb;
    for item in select c.value from jsonb_array_elements(p_changes) c
      join public.athletes a on a.id = (c.value ->> 'athleteId')::uuid
      where a.registration_id = r.id order by a.id
    loop
      select * into before_athlete from public.athletes
      where id = (item ->> 'athleteId')::uuid for update;
      after_athlete := before_athlete;

      if item ? 'weightClass' or item ? 'total' then
        if not (item ? 'weightClass' and item ? 'total') then
          raise exception 'Incomplete results' using errcode = 'CW004';
        end if;
        if (before_athlete.weight_class, before_athlete.total) is distinct from
          (item ->> 'weightClass', (item ->> 'total')::integer) then
          if not coalesce(p_results_open, false) then
            raise exception 'Results changes closed' using errcode = 'CW005';
          end if;
          after_athlete.weight_class := item ->> 'weightClass';
          after_athlete.total := (item ->> 'total')::integer;
        end if;
      end if;

      if item ? 'addCwo' then
        new_invoice := item -> 'addCwo' ->> 'invoiceNumber';
        if new_invoice is null or new_invoice !~ '^\d{8}$'
          or coalesce(item -> 'addCwo' ->> 'tshirtSize', '') not in ('XS','S','M','L','XL','XXL')
          or item ? 'tshirtSize' then
          raise exception 'Invoice and T-shirt required' using errcode = 'CW004';
        end if;
        if before_athlete.cwo then
          -- A retried request must not replace an existing invoice or T-shirt.
          if r.invoice_number is distinct from new_invoice or
            before_athlete.tshirt_size is distinct from (item -> 'addCwo' ->> 'tshirtSize') then
            raise exception 'Registration changed; reload it' using errcode = 'CW004';
          end if;
        else
          if not coalesce(p_competitions_open, false) then
            raise exception 'Competition changes closed' using errcode = 'CW006';
          end if;
          if r.kind <> 'individual' or r.invoice_number is not null then
            raise exception 'Invalid CWO addition' using errcode = 'CW004';
          end if;
          select count(*) into registered from public.athletes a
          join public.registrations reg on reg.id = a.registration_id
          where reg.status = 'active' and reg.invoice_number = new_invoice and reg.id <> r.id;
          if registered + 1 > p_invoice_limit then
            raise exception 'Invoice is full' using errcode = 'CW001';
          end if;
          if exists (
            select 1 from public.athletes a join public.registrations reg on reg.id = a.registration_id
            where reg.status = 'active' and reg.invoice_number = new_invoice and reg.id <> r.id
              and (a.email = before_athlete.email or (
                public.registration_name(a.first_name) = public.registration_name(before_athlete.first_name)
                and public.registration_name(a.last_name) = public.registration_name(before_athlete.last_name)
                and a.birth_date = before_athlete.birth_date))
          ) then
            raise exception 'Athlete already on invoice' using errcode = 'CW002';
          end if;
          -- Preserve the original AM code; both it and the new invoice keep working.
          update public.registrations set invoice_number = new_invoice where id = r.id;
          r.invoice_number := new_invoice;
          after_athlete.cwo := true;
          after_athlete.tshirt_size := item -> 'addCwo' ->> 'tshirtSize';
        end if;
      end if;

      if item ? 'addAmcr' then
        if coalesce(btrim(item -> 'addAmcr' ->> 'university'), '') = '' or item ? 'university' then
          raise exception 'University required' using errcode = 'CW004';
        end if;
        if before_athlete.amcr then
          if before_athlete.university is distinct from (item -> 'addAmcr' ->> 'university') then
            raise exception 'Registration changed; reload it' using errcode = 'CW004';
          end if;
        else
          if not coalesce(p_competitions_open, false) then
            raise exception 'Competition changes closed' using errcode = 'CW006';
          end if;
          after_athlete.amcr := true;
          after_athlete.university := item -> 'addAmcr' ->> 'university';
        end if;
      end if;

      if item ? 'tshirtSize' and after_athlete.tshirt_size is distinct from (item ->> 'tshirtSize') then
        if not after_athlete.cwo or coalesce(item ->> 'tshirtSize', '') not in ('XS','S','M','L','XL','XXL') then
          raise exception 'Invalid T-shirt change' using errcode = 'CW004';
        end if;
        if not coalesce(p_competitions_open, false) then
          raise exception 'Details changes closed' using errcode = 'CW006';
        end if;
        after_athlete.tshirt_size := item ->> 'tshirtSize';
      end if;
      if item ? 'university' and after_athlete.university is distinct from (item ->> 'university') then
        if not after_athlete.amcr or coalesce(btrim(item ->> 'university'), '') = '' then
          raise exception 'Invalid university change' using errcode = 'CW004';
        end if;
        if not coalesce(p_competitions_open, false) then
          raise exception 'Details changes closed' using errcode = 'CW006';
        end if;
        after_athlete.university := item ->> 'university';
      end if;

      if public.athlete_details(before_athlete) is distinct from public.athlete_details(after_athlete) then
        update public.athletes set weight_class = after_athlete.weight_class,
          total = after_athlete.total, cwo = after_athlete.cwo, amcr = after_athlete.amcr,
          tshirt_size = after_athlete.tshirt_size, university = after_athlete.university
        where id = before_athlete.id;
        changed := changed + 1;
        changes := changes || jsonb_build_array(jsonb_build_object(
          'before', public.athlete_details(before_athlete), 'after', public.athlete_details(after_athlete)
        ));
      end if;
    end loop;
    if jsonb_array_length(changes) > 0 then
      groups := groups || jsonb_build_array(jsonb_build_object(
        'registration', public.registration_details(r.id), 'changes', changes
      ));
    end if;
  end loop;
  return jsonb_build_object('changed', changed, 'registrations', groups);
end;
$$;

revoke execute on function
  public.registration_name(text), public.athlete_details(public.athletes),
  public.registration_details(uuid), public.set_athlete_registration_active(),
  public.sync_registration_active(),
  public.apply_registration_changes(text, text, text, jsonb, boolean, boolean, integer)
from public, anon, authenticated;
grant execute on function
  public.registration_name(text), public.athlete_details(public.athletes),
  public.registration_details(uuid), public.set_athlete_registration_active(),
  public.sync_registration_active(),
  public.apply_registration_changes(text, text, text, jsonb, boolean, boolean, integer)
to service_role;
