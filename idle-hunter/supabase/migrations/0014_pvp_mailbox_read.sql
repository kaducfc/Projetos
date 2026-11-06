-- Correio — marca se o jogador já ABRIU a mensagem (diferente de
-- "claimed", que é se já resgatou o item) — usado pra destacar mensagem
-- não lida na lista e mostrar um indicador no menu "Outros"/"Correio"
-- (ver js/main.js updateMailBadges).
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do painel Supabase
-- e rode uma vez. Seguro rodar de novo.

alter table public.pvp_mailbox
  add column if not exists read boolean not null default false;

-- "claimed" já estava liberado pro update do próprio jogador (ver
-- 0010_pvp_mailbox.sql) — agora "read" entra na mesma lista.
revoke update on public.pvp_mailbox from authenticated;
grant update (claimed, read) on public.pvp_mailbox to authenticated;
