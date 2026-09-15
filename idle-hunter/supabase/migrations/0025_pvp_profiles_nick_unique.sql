-- Corrige nicks duplicados na Arena (ver pvp_profiles): até agora "nick"
-- não tinha NENHUMA garantia de unicidade no banco — só uma checagem do
-- lado do cliente (isNickAvailable, js/systems/pvp.js), rodada na hora que
-- o jogador clica em salvar. Como a gravação de fato só acontece DEPOIS
-- (syncProfile, periódico — não na hora do clique), 2 sessões diferentes
-- podiam checar "disponível" quase ao mesmo tempo, as duas passarem, e as
-- duas sincronizarem o MESMO nick depois — daí as duplicatas no ranking.
--
-- Todo jogador novo começa com o nick padrão "Caçador" (ver
-- DEFAULT_PLAYER_NAME em js/data/profile.js) antes de escolher um nick
-- próprio — MUITOS jogadores compartilham esse valor ao mesmo tempo, de
-- propósito (o cliente já pula a checagem de disponibilidade pra ele, ver
-- saveProfileNameFlow em js/main.js). Por isso o índice único abaixo é
-- PARCIAL (`where nick <> 'Caçador'`): só nicks escolhidos pelo jogador
-- precisam ser únicos, o padrão nunca entra nessa regra.
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do painel Supabase
-- (https://supabase.com/dashboard/project/_/sql) e rode uma vez. Seguro
-- rodar de novo.

-- 1) Deduplica o que já existe: pra cada grupo de nick repetido
-- (case-insensitive, ignorando o padrão "Caçador"), mantém intacto o mais
-- ANTIGO (menor updated_at) e renomeia os demais adicionando um sufixo
-- curto derivado do próprio id — sem isso o índice único do passo 2 abaixo
-- falharia ao tentar criar.
with dupes as (
  select id, nick,
         row_number() over (partition by lower(nick) order by updated_at asc) as rn
  from public.pvp_profiles
  where nick <> 'Caçador'
)
update public.pvp_profiles p
set nick = p.nick || '_' || substr(p.id::text, 1, 4)
from dupes d
where p.id = d.id and d.rn > 1;

-- 2) Trava contra duplicata nova daqui pra frente — case-insensitive
-- (lower(nick)), excluindo o padrão "Caçador" (ver explicação acima).
drop index if exists pvp_profiles_nick_unique_idx;
create unique index pvp_profiles_nick_unique_idx
  on public.pvp_profiles (lower(nick))
  where nick <> 'Caçador';
