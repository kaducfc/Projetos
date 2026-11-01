-- Jogadores das equipes do sistema com foto.
-- Há só 60 retratos de jogadores fictícios, e cada um só pode ser de um jogador do mercado/técnicos. Para as equipes do sistema (os adversários
-- fictícios) isso não é regra: elas recebem CÓPIAS de jogadores que têm foto, da mesma posição e com OVR parecido. O mesmo jogador
-- (nome, foto e atributos) pode aparecer em mais de uma equipe do sistema, como um mesmo Legado pode estar em times de técnicos diferentes.
--   * tc_jogadores.copia_sistema marca essas cópias; elas ficam fora das regras de nome e foto únicos e não gastam retratos.
--   * tc_sistema_fotos() troca, em cada jogador de equipe do sistema sem foto, o nome/foto/atributos pelos de um jogador com foto (mesma posição,
--     OVR mais próximo, com um pequeno sorteio para variar entre as equipes). É chamada ao garantir as equipes e ao completar o elenco.
--   * Depois, os jogadores fictícios sem foto que estão livres (sem equipe) saem do jogo. Jogadores de técnicos nunca são apagados nem trocados.
-- Rode depois da 0123; seguro rodar de novo.

alter table public.tc_jogadores add column if not exists copia_sistema boolean not null default false;
drop index if exists public.tc_jogadores_nome_lower;
create unique index tc_jogadores_nome_lower on public.tc_jogadores (lower(nome)) where legado_base is null and not copia_sistema;
drop index if exists public.tc_jogadores_retrato_unico;
create unique index tc_jogadores_retrato_unico on public.tc_jogadores (retrato) where ficticio and retrato is not null and not copia_sistema;

create or replace function public.tc_retrato_livre(jid bigint, g text)
returns text language sql stable security definer set search_path = public as $$
  select c.path from (
    select '/jogos/tecnico/img/retratos/' || lower(g) || lpad(i::text, 2, '0') || '.webp' as path, i
      from generate_series(1, tc_retratos_total(g)) i
  ) c
  where not exists (select 1 from tc_jogadores p where p.ficticio and p.retrato = c.path and not p.copia_sistema)
  order by md5(jid::text || ':' || c.i) limit 1;
$$;
revoke all on function public.tc_retrato_livre(bigint, text) from public, anon, authenticated;

create or replace function public.tc_reabastecer()
returns int language plpgsql security definer set search_path = public as $$
declare
  alvo int := ((tc_cfg('pool_alvo'))::text)::int;
  v text;
  falta int;
  livres int;
  total int := 0;
  restantes int := 5;
begin
  perform pg_advisory_xact_lock(85001);
  select tc_retratos_total('M') + tc_retratos_total('F') - count(*) into livres from tc_jogadores where ficticio and retrato is not null and not copia_sistema;
  foreach v in array array['top', 'selva', 'meio', 'atirador', 'suporte'] loop
    exit when livres <= 0;
    -- divide os retratos livres entre as posições que faltam (não deixa o topo levar tudo)
    select least(greatest(0, alvo - count(*)), ceil(livres::numeric / restantes)::int) into falta from tc_jogadores where org_id is null and ficticio and pos = v;
    if falta > 0 then
      perform tc_gerar_jogadores(falta, null, v);
      total := total + falta; livres := livres - falta;
    end if;
    restantes := restantes - 1;
  end loop;
  delete from tc_jogadores where org_id is null and ficticio and retrato is null; -- sem retrato livre (gênero esgotado): não entra
  return total;
end;
$$;
revoke all on function public.tc_reabastecer() from public, anon, authenticated;

create or replace function public.tc_sistema_fotos(oid bigint default null)
returns int language plpgsql security definer set search_path = public as $$
declare
  r tc_jogadores;
  d tc_jogadores;
  n int := 0;
begin
  for r in select j.* from tc_jogadores j join tc_orgs o on o.id = j.org_id
            where o.user_id is null and j.ficticio and j.retrato is null and (oid is null or j.org_id = oid) order by j.id loop
    select d2.* into d from tc_jogadores d2
     where d2.ficticio and d2.retrato is not null and not d2.copia_sistema and d2.pos = r.pos
     order by abs(tc_poder(d2) - tc_poder(r)) + (abs(hashtextextended(d2.id::text || ':' || r.id::text, 0)) % 400) / 100.0
     limit 1;
    if d.id is null then continue; end if; -- sem jogador com foto nessa posição
    update tc_jogadores set nome = d.nome, genero = d.genero, retrato = d.retrato, idade = d.idade, regiao = d.regiao, potencial = d.potencial, fama = d.fama,
           mec = d.mec, rotas = d.rotas, macro = d.macro, tf = d.tf, mental = d.mental, copia_sistema = true
     where id = r.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke all on function public.tc_sistema_fotos(bigint) from public, anon, authenticated;

create or replace function public.tc_completar_elenco(oid bigint)
returns int language plpgsql security definer set search_path = public as $$
declare
  v text;
  achou bigint;
  n int := 0;
  tecnico boolean := exists (select 1 from tc_orgs where id = oid and user_id is not null);
begin
  if exists (select 1 from tc_orgs where id = oid and elenco_pendente) then return 0; end if; -- ainda escolhendo os 5 iniciais
  foreach v in array array['top', 'selva', 'meio', 'atirador', 'suporte'] loop
    if not exists (select 1 from tc_jogadores where org_id = oid and slot = v) then
      select id into achou from tc_jogadores j
       where org_id = oid and slot is null and (pos = v or v = any (pos2))
         and (not tecnico or tc_contrato_ativo(j))
       order by (mec + rotas + macro + tf + mental) desc limit 1;
      if achou is not null then
        update tc_jogadores set slot = v where id = achou;
      else
        perform tc_preencher_vaga(oid, v);
      end if;
      n := n + 1;
    end if;
  end loop;
  if n > 0 and not tecnico then perform tc_sistema_fotos(oid); end if; -- jogador novo de equipe do sistema recebe a foto de um jogador parecido
  return n;
end;
$$;
revoke all on function public.tc_completar_elenco(bigint) from public, anon, authenticated;

create or replace function public.tc_garantir_sistema()
returns void language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  update tc_orgs set ativa = true where user_id is null and not ativa;
  select count(*) into n from tc_orgs where user_id is null and ativa and divisao = 'principal';
  if n < 8 then perform tc_criar_equipes_sistema('principal', 8 - n, 64); end if;
  select count(*) into n from tc_orgs where user_id is null and ativa and divisao = 'acesso';
  if n < 8 then perform tc_criar_equipes_sistema('acesso', 8 - n, 48); end if;
  perform tc_sistema_fotos();
end;
$$;
revoke all on function public.tc_garantir_sistema() from public, anon, authenticated;

-- Aplica agora e limpa: equipes do sistema ficam com fotos; fictícios livres sem foto saem do jogo.
do $$
declare
  trocados int;
  apagados int;
  de_tecnicos int;
begin
  trocados := tc_sistema_fotos();
  delete from tc_jogadores where ficticio and retrato is null and org_id is null;
  get diagnostics apagados = row_count;
  select count(*) into de_tecnicos from tc_jogadores j join tc_orgs o on o.id = j.org_id where o.user_id is not null and j.ficticio and j.retrato is null;
  raise notice 'Equipes do sistema: % jogadores trocados por jogadores com foto; % jogadores livres sem foto apagados; % jogadores de técnicos continuam sem foto (não mexo nesses).', trocados, apagados, de_tecnicos;
end;
$$;
