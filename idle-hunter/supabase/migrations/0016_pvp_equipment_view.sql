-- Ver o equipamento de outros jogadores na página Ranks (qualquer uma das
-- 3 seções — Arena/Nível/Transcender) — clicar na linha de alguém que não
-- seja você mesmo abre uma janela com o boneco de equipamentos dele
-- (mesmo layout da aba Equipamentos), e clicar num item mostra os bônus e
-- cartas equipadas naquele item (ver showForeignEquipmentModal/
-- showForeignItemDetailModal em js/ui/render.js).
--
-- Mesmo modelo de confiança que hunter_level/transcend_count/is_vip já
-- tinham (ver 0001/0015_pvp_vip_nick.sql): o cliente se auto-reporta o
-- próprio equipamento ao sincronizar o perfil (ver syncProfile em
-- js/systems/pvp.js) — só cosmético/visual (ninguém mais lê essa coluna
-- pra calcular dano/loot de ninguém, a luta em si continua resolvida pelo
-- pvp_snapshots de sempre), não vale a pena um caminho de verificação
-- server-side pra isso.
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do painel Supabase
-- (https://supabase.com/dashboard/project/_/sql) e rode uma vez. Seguro
-- rodar de novo.

alter table public.pvp_profiles
  add column if not exists equipped_snapshot jsonb not null default '[]'::jsonb;

-- pvp_profiles só deixa "authenticated" atualizar uma lista específica de
-- colunas (ver 0002/0008/0015 anteriores) — sem equipped_snapshot nessa
-- lista, o upsert inteiro em syncProfile falharia calado (mesmo problema
-- documentado em 0015_pvp_vip_nick.sql).
grant update (id, nick, icon_id, hunter_level, transcend_count, is_vip, equipped_snapshot, updated_at)
  on public.pvp_profiles to authenticated;

-- Nenhuma mudança de RLS/RPC necessária além disso: "profiles are
-- publicly readable" (ver 0001_pvp_arena.sql) já libera SELECT em
-- QUALQUER coluna de qualquer linha pra todo autenticado — inclusive a
-- nova equipped_snapshot — então o cliente busca o equipamento de um
-- jogador direto (select equipped_snapshot, nick, icon_id, is_vip from
-- pvp_profiles where id = <entity_id>), sem precisar de uma RPC nova.
