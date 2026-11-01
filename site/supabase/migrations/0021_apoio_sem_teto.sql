-- Apoio: mínimo de R$ 5 no site e sem limite para cima (antes: até R$ 5.000
-- no banco e R$ 1.000 no site). Rodar depois da 0020.
alter table public.site_apoios drop constraint if exists site_apoios_valor_check;
alter table public.site_apoios add constraint site_apoios_valor_check check (valor >= 1);
