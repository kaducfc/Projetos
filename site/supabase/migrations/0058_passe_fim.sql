-- Passe Halloween 2026: termina no dia 31/10/2026 à meia-noite (fim do dia, horário de
-- Brasília). Depois disso o passe sai do ar (não dá mais para ganhar abóboras, resgatar
-- recompensas nem comprar o Premium). Rodar de novo é seguro.
update public.site_passes set fim = date '2026-10-31' where id = 'halloween-2026';
