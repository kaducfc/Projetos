-- Corrige o rank de Arena (menu Outros > Ranks) vindo sempre vazio, e
-- adiciona vitórias na saída dele.
--
-- Causa do rank vazio: pvp_rank_arena (ver 0008_pvp_ranks.sql) faz um JOIN
-- com public.pvp_tiers pra saber o order_index/hidden_score de cada tier.
-- Só que pvp_tiers tem RLS ligado e NUNCA teve uma policy de SELECT pra
-- "authenticated" (de propósito, ver 0002_pvp_tiers.sql — é uma tabela só
-- de metadados internos, o cliente tem sua própria cópia hardcoded em
-- js/data/pvpConfig.js e nunca precisou consultá-la direto... até essa
-- função). Sem policy, o JOIN via RPC (que roda com o privilégio de quem
-- chamou, não do dono da função) via RLS filtra a tabela inteira, dando 0
-- linhas — sem erro nenhum, só um resultado vazio, daí o rank "sumir".
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do painel Supabase
-- e rode uma vez. Seguro rodar de novo.

-- pvp_tiers é só metadado estático (nome/ordem/pontuação-base/se esconde
-- pontuação) — nada sensível, mesma lógica de "publicly readable" que
-- pvp_bots já tem.
drop policy if exists "tiers are publicly readable" on public.pvp_tiers;
create policy "tiers are publicly readable" on public.pvp_tiers
  for select to authenticated using (true);

-- Rank de Arena agora também devolve "wins" (mudou o formato de retorno —
-- precisa dropar antes de recriar).
drop function if exists public.pvp_rank_arena(uuid);

create or replace function public.pvp_rank_arena(viewer_id uuid)
returns table (
  entity_id uuid,
  nick text,
  icon_id text,
  tier text,
  hunter_level integer,
  rating integer,
  wins integer,
  "position" integer
)
language sql
stable
as $$
  with ranked as (
    select
      p.id as entity_id, p.nick, p.icon_id, p.tier, p.hunter_level, p.wins,
      case when t.hidden_score then null else p.rating end as rating,
      row_number() over (order by t.order_index desc, p.rating desc, p.id asc)::int as "position"
    from public.pvp_profiles p
    join public.pvp_tiers t on t.name = p.tier
  )
  select * from ranked where "position" <= 100 or entity_id = viewer_id
  order by "position";
$$;

grant execute on function public.pvp_rank_arena(uuid) to authenticated;
