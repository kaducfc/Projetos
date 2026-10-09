-- Ícone e efeito "Final CBLOL 2026" liberados para as contas de administrador (para equipar em
-- Meu perfil e ver no ranking). Para tirar depois, apague as linhas em site_recompensas
-- (tipo 'icone' chave 'exc-los-furia' e tipo 'efeito' chave 'lj-negativo'). Rodar de novo é seguro.
insert into public.site_recompensas (user_id, tipo, chave, origem)
select a.user_id, v.tipo, v.chave, 'admin'
  from public.site_admins a
 cross join (values ('icone', 'exc-los-furia'), ('efeito', 'lj-negativo')) as v(tipo, chave)
on conflict do nothing;
