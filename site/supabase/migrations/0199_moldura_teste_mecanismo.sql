-- Moldura nova em teste: Mecanismo Arcano (mn-mecanismo), liberada só para as contas de administrador
-- (equipa no perfil e aparece na aba Teste do painel). Rodar de novo é seguro.
insert into public.site_recompensas (user_id, tipo, chave, origem)
select a.user_id, 'moldura', 'mn-mecanismo', 'admin'
  from public.site_admins a
on conflict do nothing;
