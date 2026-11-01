-- Molduras novas em teste: 5 de arte (mn-*), liberadas só para as
-- contas de administrador (equipam no perfil e aparecem na aba Teste do painel).
-- Para lançar uma: tirar de MOLDURAS_TESTE para MOLDURAS em shared/molduras.js e definir como
-- conseguir (passe, loja ou código). Rodar de novo é seguro.
insert into public.site_recompensas (user_id, tipo, chave, origem)
select a.user_id, 'moldura', m.chave, 'admin'
  from public.site_admins a
 cross join (values ('mn-zaun'), ('mn-poro'), ('mn-hextech'), ('mn-robo'), ('mn-pirata')) as m(chave)
on conflict do nothing;
