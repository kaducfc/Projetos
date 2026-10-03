-- Ranqueada: só vale a carreira que COMEÇOU no mesmo dia em que terminou.
--
-- Antes dava para começar uma carreira num dia (com as 3 ranqueadas já
-- usadas), jogar até ver que estava indo muito bem e só terminar no dia
-- seguinte, para ela valer no outro dia. Agora:
--   * Ao começar uma carreira (com a conta conectada), o jogo pede ao servidor
--     um "ingresso" (site_ranked_iniciar). O servidor anota o dia, pelo
--     relógio dele (horário de Brasília), não pelo do navegador.
--   * Ao terminar, o resultado leva esse ingresso. Só entra na ranqueada se o
--     ingresso for da própria conta, for de HOJE e ainda não tiver sido usado.
--   * Carreira sem ingresso (começou sem conta, sem internet ou antes desta
--     mudança) não vale para a ranqueada; continua no histórico normalmente.
--
-- Como aplicar: cole este arquivo no SQL Editor do Supabase e clique em Run
-- (depois do 0009). Rodar de novo é seguro.

create table if not exists public.site_ranked_inicios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dia date not null,
  criado timestamptz not null default now(),
  result_id uuid unique references public.site_game_results(id) on delete set null
);
create index if not exists site_ranked_inicios_user on public.site_ranked_inicios (user_id, dia);
-- Ninguém lê nem grava direto: só pelas funções abaixo.
alter table public.site_ranked_inicios enable row level security;

-- Começo de carreira: devolve o ingresso e o dia (do servidor).
create or replace function public.site_ranked_iniciar()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  hoje date := site_hoje_br();
  novo uuid;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  -- Limite de segurança contra abuso (ninguém começa 200 carreiras por dia).
  if (select count(*) from site_ranked_inicios where user_id = uid and dia = hoje) >= 200 then
    return jsonb_build_object('token', null, 'dia', hoje);
  end if;
  insert into site_ranked_inicios (user_id, dia) values (uid, hoje) returning id into novo;
  return jsonb_build_object('token', novo, 'dia', hoje);
end;
$$;
revoke all on function public.site_ranked_iniciar() from public, anon;
grant execute on function public.site_ranked_iniciar() to authenticated;

-- Fim de carreira: as 3 primeiras do dia valem, desde que tenham começado hoje.
create or replace function public.site_ranked_registrar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  hoje date := site_hoje_br();
  tok text := new.summary->>'ranked';
  usado uuid;
begin
  if new.game_id <> 'carreira-no-rift' or new.score is null or new.score < 0 or new.score > 3000 then
    return new;
  end if;
  if tok is null or tok !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext('ranked:' || new.user_id::text));
  if (select count(*) from site_ranked_partidas where user_id = new.user_id and dia = hoje) >= 3 then
    return new;
  end if;
  -- Ingresso da própria conta, de hoje e ainda não usado.
  update site_ranked_inicios set result_id = new.id
   where id = tok::uuid and user_id = new.user_id and dia = hoje and result_id is null
  returning id into usado;
  if usado is null then
    return new;
  end if;
  insert into site_ranked_partidas (user_id, dia, score, result_id)
  values (new.user_id, hoje, round(new.score), new.id);
  insert into site_ranked (user_id) values (new.user_id) on conflict (user_id) do nothing;
  return new;
end;
$$;
