-- Passe de Batalha: o jogador não vê "total de abóboras", só o NÍVEL do passe e a
-- barra de progresso dentro do nível (0 a 100). Cada 100 abóboras sobem um nível
-- (a barra esvazia e começa de novo) e as recompensas são liberadas pelo nível.
-- Só muda o que a função devolve: `abobora` (total) e `exige` saem, entra
-- `progresso` (abóboras já ganhas neste nível; no nível máximo, a barra cheia).
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e clique em
-- Run (depois da 0039). Rodar de novo é seguro.

create or replace function public.site_passe_estado(pid text default 'halloween-2026')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  p site_passes;
  prog site_passe_progresso;
  hoje int;
  nivel int;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  select * into p from site_passes where id = pid;
  if p.id is null or not site_passe_acessivel(p, uid) then
    raise exception 'passe_indisponivel';
  end if;
  select * into prog from site_passe_progresso where user_id = uid and passe = pid;
  select coalesce(d.abobora, 0) into hoje from site_passe_dia d where d.user_id = uid and d.passe = pid and d.dia = site_hoje_br();
  nivel := least(p.niveis, floor(coalesce(prog.abobora, 0)::numeric / p.abobora_por_nivel)::int);
  return jsonb_build_object(
    'passe', jsonb_build_object('id', p.id, 'nome', p.nome, 'niveis', p.niveis, 'abobora_por_nivel', p.abobora_por_nivel,
                                'abobora_por_partida', p.abobora_por_partida, 'limite_dia', p.limite_dia, 'publico', p.publico),
    'nivel', nivel,
    'progresso', case when nivel >= p.niveis then p.abobora_por_nivel
                      else (coalesce(prog.abobora, 0) - nivel::bigint * p.abobora_por_nivel)::int end,
    'premium', coalesce(prog.premium, false),
    'hoje', coalesce(hoje, 0),
    'niveis', coalesce((select jsonb_agg(jsonb_build_object(
        'nivel', n.nivel, 'trilha', n.trilha, 'tipo', n.tipo, 'chave', n.chave,
        'resgatado', exists (select 1 from site_passe_resgates r where r.user_id = uid and r.passe = pid and r.nivel = n.nivel))
        order by n.nivel) from site_passe_niveis n where n.passe = pid and n.nivel <= p.niveis), '[]'::jsonb));
end;
$$;
revoke all on function public.site_passe_estado(text) from public, anon;
grant execute on function public.site_passe_estado(text) to authenticated;
