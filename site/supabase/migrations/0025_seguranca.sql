-- Segurança (revisão de outubro/2026). Rodar depois da 0024.
--
-- 1. Limites contra encher o banco: tamanho e quantidade de saves,
--    resultados e estatísticas (o plano grátis do Supabase tem 500 MB).
-- 2. Lendas do CBLOL: o resultado enviado precisa fazer sentido
--    (vitórias, fase, invicto) para valer PDR.
-- 3. Resultados não podem mais ser apagados pela própria conta (apagar
--    escondia os detalhes da partida na vigilância do painel).
-- 4. Funções antigas ou internas deixam de ficar abertas pela API.

-- ------------------------------------------------------------ resultados
-- Hora em que o servidor recebeu (a "played_at" vem do navegador). As
-- linhas antigas ficam vazias e não contam no limite do dia.
alter table public.site_game_results add column if not exists recebido timestamptz;
alter table public.site_game_results alter column recebido set default now();
create index if not exists site_game_results_user_recebido on public.site_game_results (user_id, recebido desc);

create or replace function public.site_game_results_limites()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v text;
  res text;
  vit int;
begin
  -- Linha fora do padrão é descartada em silêncio (não trava o envio das
  -- outras partidas, que vão juntas no mesmo pedido).
  if pg_column_size(new.summary) > 8192 or char_length(new.client_id) > 64
     or (new.score is not null and (new.score = 'NaN' or abs(new.score) > 1e9)) then
    return null;
  end if;
  if (select count(*) from site_game_results r
       where r.user_id = new.user_id and r.recebido > now() - interval '1 day') >= 300 then
    return null;
  end if;
  new.recebido := now();
  new.played_at := least(coalesce(new.played_at, now()), now());

  -- Lendas (Oculto) valendo PDR: confere se o resultado é possível. Se não
  -- for, a partida fica salva mas sem valer para a ranqueada.
  if new.game_id = 'cblol' and new.summary ? 'ranked' then
    v := new.summary->>'vitorias';
    res := new.summary->>'resultado';
    if v is null or v !~ '^[0-7]$' or res is null
       or res not in ('fase', 'quartas', 'semi', 'final', 'vice', 'campeao') then
      new.summary := new.summary - 'ranked';
    else
      vit := v::int;
      if (res = 'fase') <> (vit < 4) then
        new.summary := new.summary - 'ranked';
      else
        -- "Invicto" é calculado aqui: campeão com as 7 vitórias.
        new.summary := jsonb_set(new.summary, '{invicto}', to_jsonb(res = 'campeao' and vit = 7));
      end if;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.site_game_results_limites() from public, anon, authenticated;
drop trigger if exists site_game_results_limites on public.site_game_results;
create trigger site_game_results_limites
  before insert on public.site_game_results
  for each row execute function public.site_game_results_limites();

-- Resultado registrado não se apaga pela API (conta apagada leva tudo junto).
drop policy if exists "site_game_results dono apaga" on public.site_game_results;
revoke delete, update, truncate on public.site_game_results from anon, authenticated;

-- ----------------------------------------------------------------- saves
-- O maior save de Carreira fica em ~15 KB; 256 KB é folga de sobra.
create or replace function public.site_game_saves_limites()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if pg_column_size(new.data) > 262144 then
    raise exception 'save_grande';
  end if;
  if tg_op = 'INSERT' and (select count(*) from site_game_saves s where s.user_id = new.user_id) >= 20 then
    raise exception 'saves_demais';
  end if;
  return new;
end;
$$;
revoke all on function public.site_game_saves_limites() from public, anon, authenticated;
drop trigger if exists site_game_saves_limites on public.site_game_saves;
create trigger site_game_saves_limites
  before insert or update on public.site_game_saves
  for each row execute function public.site_game_saves_limites();
revoke truncate on public.site_game_saves from anon, authenticated;

-- ----------------------------------------------------- estatísticas (visitas)
-- Qualquer visitante pode registrar eventos; sem limite, um robô enchia o
-- banco. Teto por hora (somando todo mundo) e tamanho menor por evento.
create table if not exists public.site_events_cota (
  hora timestamptz primary key,
  n int not null default 0
);
alter table public.site_events_cota enable row level security;
revoke all on public.site_events_cota from anon, authenticated;

create or replace function public.site_events_limites()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  h timestamptz := date_trunc('hour', now());
  k int;
begin
  if pg_column_size(new.data) > 2048 then
    return null;
  end if;
  insert into site_events_cota as c (hora, n) values (h, 1)
  on conflict (hora) do update set n = c.n + 1
  returning c.n into k;
  if k = 1 then
    delete from site_events_cota where hora < h - interval '2 days';
  end if;
  if k > 5000 then
    return null;
  end if;
  new.created_at := now();
  return new;
end;
$$;
revoke all on function public.site_events_limites() from public, anon, authenticated;
drop trigger if exists site_events_limites on public.site_events;
create trigger site_events_limites
  before insert on public.site_events
  for each row execute function public.site_events_limites();

-- --------------------------------------------- funções fechadas para a API
-- Gatilhos (só o banco chama).
revoke all on function public.site_handle_new_user() from public, anon, authenticated;
revoke all on function public.site_apoio_recalcular() from public, anon, authenticated;
revoke all on function public.site_ranked_registrar() from public, anon, authenticated;
revoke all on function public.site_icone_especial_confere() from public, anon, authenticated;
-- Ranqueada antiga (antes do PDR): ninguém usa mais.
revoke all on function public.site_ranked_processar() from public, anon, authenticated;
revoke all on function public.site_ranking(text) from public, anon, authenticated;
revoke all on function public.site_ranked_meu() from public, anon, authenticated;
revoke all on function public.site_ranked_resetar(int) from public, anon, authenticated;

-- Tabelas que a API nunca usa diretamente: tira até a permissão de base
-- (o RLS já bloqueava; isto é uma segunda tranca).
revoke all on public.site_admins, public.site_apoios, public.site_rk, public.site_rk_lanc,
  public.site_rk_dia, public.site_rk_config, public.site_diario, public.site_diario_palavras,
  public.site_diario_campeoes, public.site_ranked_inicios, public.site_ranked_banidos,
  public.site_ranked_compensacao, public.site_ranked_partidas, public.site_ranked_config,
  public.site_ranked_ciclos, public.site_ranked_historico
  from anon;
revoke insert, update, delete, truncate on public.site_admins, public.site_apoios, public.site_rk,
  public.site_rk_lanc, public.site_rk_dia, public.site_rk_config, public.site_diario,
  public.site_diario_palavras, public.site_diario_campeoes, public.site_ranked_inicios,
  public.site_ranked_banidos, public.site_ranked_compensacao, public.site_ranked_partidas,
  public.site_ranked_config, public.site_ranked_ciclos, public.site_ranked_historico
  from authenticated;
do $$
begin
  if to_regclass('public.site_escala') is not null then
    execute 'revoke all on public.site_escala, public.site_escala_itens from anon';
    execute 'revoke insert, update, delete, truncate on public.site_escala, public.site_escala_itens from authenticated';
  end if;
end $$;
revoke update, delete, truncate on public.site_profiles from anon;
revoke insert, delete, truncate on public.site_profiles from authenticated;
revoke select, update, delete, truncate on public.site_events from anon, authenticated;
