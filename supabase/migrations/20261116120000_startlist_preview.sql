-- A live start list for organisers, before it is published: one view for women, one for men.
-- Categories from the lightest to the heaviest, within a category by total, highest first.
-- Read-only, open it in the Table Editor. Only active registrations, like the start list;
-- team members are listed in their own category.

create view public.startovka_zeny with (security_invoker = true) as
select
  s.weight_class || ' kg' as vahovka,
  row_number() over (partition by s.weight_class order by s.total desc, s.last_name, s.first_name)::integer as poradi,
  s.first_name as jmeno,
  s.last_name as prijmeni,
  s.nationality as narodnost,
  s.birth_year as rocnik,
  s.total as dvojboj,
  concat_ws(' + ', case when s.cwo then 'CWO' end, case when s.amcr then 'AM ČR' end) as soutez,
  s.team_name as tym,
  s.university as skola
from public.public_startlist s
where s.sex = 'F'
order by regexp_replace(s.weight_class, '\D', '', 'g')::integer, s.weight_class like '+%',
  s.total desc, s.last_name, s.first_name;

create view public.startovka_muzi with (security_invoker = true) as
select
  s.weight_class || ' kg' as vahovka,
  row_number() over (partition by s.weight_class order by s.total desc, s.last_name, s.first_name)::integer as poradi,
  s.first_name as jmeno,
  s.last_name as prijmeni,
  s.nationality as narodnost,
  s.birth_year as rocnik,
  s.total as dvojboj,
  concat_ws(' + ', case when s.cwo then 'CWO' end, case when s.amcr then 'AM ČR' end) as soutez,
  s.team_name as tym,
  s.university as skola
from public.public_startlist s
where s.sex = 'M'
order by regexp_replace(s.weight_class, '\D', '', 'g')::integer, s.weight_class like '+%',
  s.total desc, s.last_name, s.first_name;

revoke all on public.startovka_zeny, public.startovka_muzi from anon, authenticated;
grant select on public.startovka_zeny, public.startovka_muzi to service_role;
