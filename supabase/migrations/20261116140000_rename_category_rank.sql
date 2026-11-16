-- Clearer name for organisers: the rank within the weight category.
alter view public.startovka_zeny rename column poradi to poradi_v_kategorii;
alter view public.startovka_muzi rename column poradi to poradi_v_kategorii;
