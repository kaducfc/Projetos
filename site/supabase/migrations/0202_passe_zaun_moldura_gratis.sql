-- Passe Zaun e Piltover: a moldura "Horizonte de Piltover" (pl-horizonte) vira a recompensa GRÁTIS do nível 14
-- (antes eram 300 RC provisórios). Também libera a moldura para as contas de administrador (equipar no perfil durante o teste).
-- Rodar depois da 0201. Rodar de novo é seguro.
update public.site_passe_niveis set tipo = 'moldura', chave = 'pl-horizonte' where passe = 'zaun-piltover-2026' and nivel = 14 and trilha = 'gratis';
insert into public.site_recompensas (user_id, tipo, chave, origem)
select a.user_id, 'moldura', 'pl-horizonte', 'admin' from public.site_admins a
on conflict do nothing;
