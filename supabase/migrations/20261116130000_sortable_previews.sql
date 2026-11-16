-- The Supabase Table Editor ignores a view's own ORDER BY and sorts by the first column.
-- The organiser views therefore start with `cislo`, a row number in the intended order:
-- women before men, categories from the lightest, totals from the highest.
-- A view cannot reorder its columns in place, so they are recreated.

drop view public.startovka_zeny, public.startovka_muzi, public.prehled_vahovek;

create view public.startovka_zeny with (security_invoker = true) as
select
  row_number() over (order by regexp_replace(s.weight_class, '\D', '', 'g')::integer,
    s.weight_class like '+%', s.total desc, s.last_name, s.first_name)::integer as cislo,
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
order by cislo;

create view public.startovka_muzi with (security_invoker = true) as
select
  row_number() over (order by regexp_replace(s.weight_class, '\D', '', 'g')::integer,
    s.weight_class like '+%', s.total desc, s.last_name, s.first_name)::integer as cislo,
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
order by cislo;

create view public.prehled_vahovek with (security_invoker = true) as
select
  row_number() over (order by s.sex, regexp_replace(s.weight_class, '\D', '', 'g')::integer,
    s.weight_class like '+%')::integer as cislo,
  case s.sex when 'F' then 'Ženy' else 'Muži' end as pohlavi,
  s.weight_class as vahovka,
  count(*)::integer as celkem,
  (count(*) filter (where s.cwo))::integer as cwo,
  (count(*) filter (where s.amcr))::integer as amcr
from public.public_startlist s
group by s.sex, s.weight_class
order by cislo;

revoke all on public.startovka_zeny, public.startovka_muzi, public.prehled_vahovek
from anon, authenticated;
grant select on public.startovka_zeny, public.startovka_muzi, public.prehled_vahovek
to service_role;
