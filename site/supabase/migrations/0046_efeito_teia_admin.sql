-- Efeito "Teia Cósmica" (hw-teia) liberado só para as contas de administrador, para
-- equipar em Meu perfil e ver no ranking. Para tirar depois, apague a linha em
-- site_recompensas (tipo 'efeito', chave 'hw-teia'). Rodar de novo é seguro.
insert into public.site_recompensas (user_id, tipo, chave, origem)
select a.user_id, 'efeito', 'hw-teia', 'admin'
  from public.site_admins a
on conflict do nothing;
