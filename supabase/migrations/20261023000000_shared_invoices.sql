-- One invoice covers 1–4 people: a team, or several individuals, e.g. from one club.
-- Replaces "one active registration per invoice" with a head-count limit and a check
-- that the same person (same e-mail, or same name and date of birth) is not registered
-- twice on the same invoice.

drop index public.registrations_invoice_active_key;
create index registrations_invoice_number_idx
  on public.registrations (invoice_number) where status = 'active';

drop function public.create_registration(jsonb, jsonb);

-- Errors: CW001 = the invoice would exceed p_invoice_limit people,
--         CW002 = an athlete is already registered on this invoice.
create function public.create_registration(
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

drop function public.find_registration(text, text, text);

-- All active registrations on the invoice (or with the code) that include the e-mail.
create function public.find_registrations(p_invoice text, p_code text, p_email text)
returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
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
  ) order by r.created_at), '[]'::jsonb)
  from public.registrations r
  where r.status = 'active'
    and (r.invoice_number = p_invoice or r.access_code = p_code)
    and exists (
      select 1 from public.athletes a
      where a.registration_id = r.id and a.email = lower(btrim(p_email))
    );
$$;

revoke execute on function
  public.create_registration(jsonb, jsonb, integer),
  public.find_registrations(text, text, text)
from public, anon, authenticated;

grant execute on function
  public.create_registration(jsonb, jsonb, integer),
  public.find_registrations(text, text, text)
to service_role;
