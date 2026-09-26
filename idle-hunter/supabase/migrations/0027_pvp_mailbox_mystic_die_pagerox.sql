-- Envia 200 Dados Místicos pro jogador de nick "PageRox" (busca
-- case-insensitive, mesmo padrão de 0020/0024) — roda só uma vez, na hora
-- que você colar isso. Se o nick ainda não tiver perfil (nunca abriu a
-- Arena/conectou), essa linha simplesmente não insere nada (0 linhas
-- afetadas) — sincronize a Arena pelo menos uma vez no jogo primeiro pra
-- criar o perfil.
--
-- Título sem emoji (pedido do usuário em 0023_pvp_mailbox_plain_titles.sql
-- — o ícone de verdade do Dado Místico já aparece sozinho na linha da
-- recompensa, ver mailRewardLineHtml em js/ui/render.js).
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do painel Supabase
-- (https://supabase.com/dashboard/project/_/sql) e rode uma vez. Seguro
-- rodar de novo (insere de novo se rodar 2x — apague a linha extra no
-- Correio do jogo se isso acontecer por engano).
insert into public.pvp_mailbox (profile_id, title, body, reward_type, reward_amount)
select id, 'Presente', 'Você recebeu 200 Dados Místicos!', 'mystic_die', 200
from public.pvp_profiles
where nick ilike 'PageRox';
