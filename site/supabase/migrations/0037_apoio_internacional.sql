-- Apoio internacional (Stripe e PayPal), para quem não está no Brasil.
-- O valor continua em reais em `valor` / `valor_pago` (convertido na hora,
-- só para somar o total apoiado e o painel); o valor de verdade, na moeda
-- paga (USD ou EUR), fica em `valor_original` + `moeda`.
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e clique
-- em Run (depois do 0036). Rodar de novo é seguro.

alter table public.site_apoios add column if not exists moeda text not null default 'BRL';
alter table public.site_apoios add column if not exists valor_original numeric(10, 2);
-- Id do pedido no provedor (sessão do Stripe ou pedido do PayPal).
alter table public.site_apoios add column if not exists ext_id text;

alter table public.site_apoios drop constraint if exists site_apoios_origem_check;
alter table public.site_apoios add constraint site_apoios_origem_check
  check (origem in ('mercadopago', 'manual', 'stripe', 'paypal'));
alter table public.site_apoios drop constraint if exists site_apoios_moeda_check;
alter table public.site_apoios add constraint site_apoios_moeda_check
  check (moeda in ('BRL', 'USD', 'EUR'));

create unique index if not exists site_apoios_ext on public.site_apoios (origem, ext_id) where ext_id is not null;
