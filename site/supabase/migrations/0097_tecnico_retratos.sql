-- Simulador de Técnico: gênero e retrato dos jogadores comuns (fictícios).
-- Rode depois do 0096. Idempotente: não muda quem já tem retrato.
--
--  * tc_jogadores.genero ('M' ou 'F'): decide qual conjunto de retratos o jogador usa.
--  * 60 retratos: m01..m35 (masculinos) e f01..f25 (femininas) em /jogos/tecnico/img/retratos/.
--  * Todo jogador fictício novo (mercado, substitutos, elenco inicial) ganha gênero e retrato sozinho, por gatilho.
--  * Jogadores que já existem sem retrato recebem um agora, de forma determinística (mesmo id, mesmo rosto).
--  * Cerca de 40% dos jogadores fictícios são jogadoras (proporção entre os retratos disponíveis).
--  * Estrelas (jogadores reais) ficam masculinas e com o retrato próprio.

alter table public.tc_jogadores add column if not exists genero text not null default 'M' check (genero in ('M', 'F'));

create or replace function public.tc_retrato_do_jogador(jid bigint, g text)
returns text language sql immutable as $$
  select '/jogos/tecnico/img/retratos/' || g_ || lpad((1 + ((jid * 2654435761 + case when g = 'F' then 7 else 3 end) % case when g = 'F' then 25 else 35 end))::text, 2, '0') || '.webp'
  from (select lower(g) as g_) x;
$$;
revoke all on function public.tc_retrato_do_jogador(bigint, text) from public, anon, authenticated;

-- ~40% feminino, determinístico pelo id.
create or replace function public.tc_genero_do_jogador(jid bigint)
returns text language sql immutable as $$
  select case when ((jid * 40503 + 17) % 100) < 40 then 'F' else 'M' end;
$$;
revoke all on function public.tc_genero_do_jogador(bigint) from public, anon, authenticated;

create or replace function public.tc_jogador_retrato_auto()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.ficticio and new.retrato is null then
    new.genero := tc_genero_do_jogador(new.id);
    new.retrato := tc_retrato_do_jogador(new.id, new.genero);
  end if;
  return new;
end;
$$;
revoke all on function public.tc_jogador_retrato_auto() from public, anon, authenticated;
drop trigger if exists tc_jogador_retrato_auto on public.tc_jogadores;
create trigger tc_jogador_retrato_auto before insert on public.tc_jogadores
  for each row execute function public.tc_jogador_retrato_auto();

-- Jogadores que já existem
update public.tc_jogadores set genero = tc_genero_do_jogador(id), retrato = tc_retrato_do_jogador(id, tc_genero_do_jogador(id))
 where ficticio and retrato is null;
update public.tc_jogadores set genero = 'M' where not ficticio;

-- JSON com o gênero (mesma forma do 0096 + 'genero')
create or replace function public.tc_jogador_json(j tc_jogadores, ver_pot boolean default true)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  p double precision := tc_poder(j);
begin
  return jsonb_build_object(
    'id', j.id, 'nome', j.nome, 'ficticio', j.ficticio, 'genero', j.genero, 'pos', j.pos, 'pos2', to_jsonb(j.pos2),
    'idade', j.idade, 'regiao', j.regiao, 'retrato', j.retrato,
    'mec', j.mec, 'rotas', j.rotas, 'macro', j.macro, 'tf', j.tf, 'mental', j.mental, 'fama', j.fama,
    'potencial', case when ver_pot then j.potencial else null end,
    'forma', j.forma, 'exp', j.exp, 'poder', round(p)::int,
    'org_id', j.org_id, 'slot', j.slot, 'salario', j.salario, 'contrato_fim', j.contrato_fim,
    'preco', tc_preco(p, j.potencial, j.fama, j.idade),
    'estrela', not j.ficticio,
    'preco_rc', tc_estrela_preco_rc(j),
    'venda_rc', case when j.ficticio then null else coalesce(((tc_cfg('estrelas'))->>'venda_rc')::boolean, false) end);
end;
$$;
revoke all on function public.tc_jogador_json(tc_jogadores, boolean) from public, anon, authenticated;
