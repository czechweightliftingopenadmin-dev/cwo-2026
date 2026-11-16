-- One person, one active registration: identity is now name and date of birth, without the
-- e-mail. A team captain often registers members under another e-mail, which let the same
-- person in twice (an AM ČR registration of their own, then again in a CWO team).
--
-- Registering with CWO takes over the person's own AM ČR-only registration: AM ČR and the
-- school carry over to the new entry and the old registration is cancelled with a note.
-- Every other second registration of the same person is refused by the unique index.
--
-- Like registration_changes, this never merges existing people on its own: resolve any
-- active duplicates by hand (cancel one registration) before applying it.

do $$
begin
  if exists (
    select 1 from public.athletes a
    where a.registration_active
    group by public.registration_name(a.first_name), public.registration_name(a.last_name),
      a.birth_date
    having count(*) > 1
  ) then
    raise exception 'Duplicate active athletes (same name and date of birth) exist. Cancel one registration of each person before applying identity_merge; no records have been merged.';
  end if;
end;
$$;

-- Same name, so the API keeps recognising the conflict.
drop index public.athletes_active_identity_key;
create unique index athletes_active_identity_key on public.athletes (
  public.registration_name(first_name), public.registration_name(last_name), birth_date
) where registration_active;

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
  previous record;
  -- New athlete position → school from the AM ČR registration taken over.
  merged jsonb := '{}'::jsonb;
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

  -- Take over the person's own AM ČR-only registration when they now register with CWO.
  for previous in
    select r.id, a.university, item.ordinality
    from jsonb_array_elements(p_athletes) with ordinality as item
    join public.athletes a on a.registration_active
      and public.registration_name(a.first_name) = public.registration_name(item.value ->> 'firstName')
      and public.registration_name(a.last_name) = public.registration_name(item.value ->> 'lastName')
      and a.birth_date = (item.value ->> 'birthDate')::date
    join public.registrations r on r.id = a.registration_id
    where coalesce((item.value ->> 'cwo')::boolean, false)
      and r.status = 'active' and r.kind = 'individual' and not a.cwo and a.amcr
    order by r.id
    for update of r
  loop
    update public.registrations
    set status = 'cancelled',
      note = concat_ws(E'\n', note, format(
        'Sloučeno do registrace %s: závodník se přihlásil znovu s CWO, AM ČR a škola přešly s ním.',
        p_registration ->> 'accessCode'))
    where id = previous.id;
    merged := merged || jsonb_build_object(previous.ordinality::text, previous.university);
  end loop;

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
    coalesce((item.value ->> 'amcr')::boolean, false) or merged ? item.ordinality::text,
    coalesce(item.value ->> 'university', merged ->> item.ordinality::text)
  from jsonb_array_elements(p_athletes) with ordinality as item;

  return new_id;
end;
$$;
