-- A mensagem original (0020_pvp_mailbox_awakening_shard.sql) provavelmente
-- foi resgatada com o jogo ainda rodando a versão em cache do navegador
-- (de ANTES do suporte a 'awakening_shard' existir no client, ver
-- js/systems/mailbox.js applyMailReward) — o servidor marcou como
-- "claimed" mesmo assim (claimMailReward sempre marca primeiro, aplica o
-- item local depois), então o Fragmento nunca chegou a entrar no save,
-- mas a mensagem não pode mais ser resgatada de novo.
--
-- Reenvia 1 Fragmento do Despertar pro "KaduCFC" numa mensagem NOVA
-- (claimed = false por padrão) — dessa vez resgate só DEPOIS de dar um
-- refresh forçado na página do jogo (Ctrl+Shift+R no PC, ou fechar/reabrir
-- a aba no celular) pra garantir que o navegador não está com o
-- js/systems/mailbox.js antigo em cache.
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do painel Supabase
-- (https://supabase.com/dashboard/project/_/sql) e rode uma vez. Seguro
-- rodar de novo (só cria outra mensagem se rodar de novo — apague a antiga
-- não resgatada no Correio do jogo se isso acontecer, ou ignore, ela não
-- tem custo nenhum ficar lá).

insert into public.pvp_mailbox (profile_id, title, body, reward_type, reward_amount)
select id, '🌌 Presente', 'Você recebeu 1 Fragmento do Despertar! (reenvio — dê um refresh forçado na página antes de resgatar)', 'awakening_shard', 1
from public.pvp_profiles
where nick ilike 'KaduCFC';
