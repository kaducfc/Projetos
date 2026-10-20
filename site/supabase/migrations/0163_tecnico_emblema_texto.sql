-- Simulador de Técnico: o emblema do time pode ser só uma ESCRITA. Rode depois do 0162. Idempotente.
-- Formato do campo tc_orgs.escudo para texto: v3:<texto 1-14>:<fonte 1-11>:<cor de cima>:<cor de baixo>:<contorno 0-8>:<cor do contorno>:<sombra 0-6>:<cor da sombra>:<placa 0-3>:<cor da placa>:<cor da borda>
--   (cores hex minúsculas sem #; o texto aceita letras, números, espaço e . & ! ' + -). Os formatos antigos (escudo-N e v2) continuam valendo.
-- Recria tc_criar_org e tc_personalizar_org trocando só a regra de validação do escudo.

create or replace function public.tc_criar_org(nome_ text, sigla_ text, escudo_ text default 'escudo-1', cor1_ text default '#1b3a6b', cor2_ text default '#d9a82b', estilo_ text default 'classico')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  n text := regexp_replace(trim(coalesce(nome_, '')), '\s+', ' ', 'g');
  s text := upper(trim(coalesce(sigla_, '')));
  oid bigint;
begin
  perform tc_exigir(uid);
  if char_length(n) < 3 or char_length(n) > 24 or n !~ '^[[:alnum:] ._''-]+$' then
    raise exception 'nome_invalido';
  end if;
  if s !~ '^[A-Z0-9]{2,4}$' then
    raise exception 'sigla_invalida';
  end if;
  if escudo_ !~ '^(escudo-[1-6]|v2:([1-9]|[12][0-9]|30):[0-9a-f]{6}:[0-9a-f]{6}:[0-9a-f]{6}:([0-9]|1[0-9]|20):[0-9a-f]{6}:[0-9a-f]{6}|v3:[A-Za-z0-9À-ÿ .&!''+-]{1,14}:([1-9]|1[01]):[0-9a-f]{6}:[0-9a-f]{6}:[0-8]:[0-9a-f]{6}:[0-6]:[0-9a-f]{6}:[0-3]:[0-9a-f]{6}:[0-9a-f]{6})$' then
    raise exception 'escudo_invalido';
  end if;
  if estilo_ not in ('classico', 'moderno', 'tecnologico') then
    raise exception 'estilo_invalido';
  end if;
  if exists (select 1 from tc_orgs where user_id = uid) then
    raise exception 'ja_tem_org';
  end if;
  if exists (select 1 from tc_orgs where lower(nome) = lower(n)) then
    raise exception 'nome_em_uso';
  end if;
  if exists (select 1 from tc_orgs where sigla = s) then
    raise exception 'sigla_em_uso';
  end if;
  -- Sem limite de técnicos: cada um joga o seu próprio campeonato contra equipes do sistema.
  insert into tc_orgs (user_id, nome, sigla, escudo, cor1, cor2, estilo, creditos, divisao)
  values (uid, n, s, escudo_, cor1_, cor2_, estilo_, ((tc_cfg('creditos_iniciais'))::text)::bigint, 'acesso')
  returning id into oid;
  insert into tc_fin (org_id, delta, saldo, motivo) values (oid, ((tc_cfg('creditos_iniciais'))::text)::bigint, ((tc_cfg('creditos_iniciais'))::text)::bigint, 'inicial');
  perform tc_elenco_inicial(oid);
  return jsonb_build_object('id', oid);
exception when unique_violation then
  raise exception 'nome_ou_sigla_em_uso';
end;
$$;
revoke all on function public.tc_criar_org(text, text, text, text, text, text) from public, anon;
grant execute on function public.tc_criar_org(text, text, text, text, text, text) to authenticated;


create or replace function public.tc_personalizar_org(escudo_ text, cor1_ text, cor2_ text, estilo_ text)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  perform tc_exigir(uid);
  if escudo_ !~ '^(escudo-[1-6]|v2:([1-9]|[12][0-9]|30):[0-9a-f]{6}:[0-9a-f]{6}:[0-9a-f]{6}:([0-9]|1[0-9]|20):[0-9a-f]{6}:[0-9a-f]{6}|v3:[A-Za-z0-9À-ÿ .&!''+-]{1,14}:([1-9]|1[01]):[0-9a-f]{6}:[0-9a-f]{6}:[0-8]:[0-9a-f]{6}:[0-6]:[0-9a-f]{6}:[0-3]:[0-9a-f]{6}:[0-9a-f]{6})$' or estilo_ not in ('classico', 'moderno', 'tecnologico') then
    raise exception 'dados_invalidos';
  end if;
  update tc_orgs set escudo = escudo_, cor1 = cor1_, cor2 = cor2_, estilo = estilo_ where user_id = uid;
  if not found then
    raise exception 'sem_org';
  end if;
end;
$$;
revoke all on function public.tc_personalizar_org(text, text, text, text) from public, anon;
grant execute on function public.tc_personalizar_org(text, text, text, text) to authenticated;

