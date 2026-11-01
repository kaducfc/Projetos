-- Efeito "Halloween 2026" (hw-neon) liberado para as contas de administrador, para
-- equipar em Meu perfil e testar. Para tirar depois, apague a linha em site_recompensas
-- (tipo 'efeito', chave 'hw-neon'). Rodar de novo é seguro.
insert into public.site_recompensas (user_id, tipo, chave, origem)
select a.user_id, 'efeito', 'hw-neon', 'admin'
  from public.site_admins a
on conflict do nothing;
