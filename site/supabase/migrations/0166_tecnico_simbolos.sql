-- Simulador de Técnico: novos símbolos de time (49, cada um aceita de 1 a 3 cores) no lugar dos emblemas, bandeiras e escudos antigos. Rode depois do 0165. Idempotente.
--  * Formato novo no campo `escudo`: v4:<símbolo 1-49>:<cor 1>[:<cor 2>[:<cor 3>]] (hex sem #). A escrita (v3) continua valendo; escudo-N e v2 deixam de ser aceitos.
--  * Converte os times que ainda usam o formato antigo (jogadores e times do sistema): recebem um símbolo e mantêm as cores do time.

create or replace function public.tc_criar_org(nome_ text, sigla_ text, escudo_ text default 'v4:1:083871:12131d', cor1_ text default '#1b3a6b', cor2_ text default '#d9a82b', estilo_ text default 'classico')
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
  if escudo_ !~ '^(v4:([1-9]|[1-3][0-9]|4[0-9])(:[0-9a-f]{6}){1,3}|v3:[A-Za-z0-9À-ÿ .&!''+-]{1,10}:([1-9]|1[01]):[0-9a-f]{6}:[0-9a-f]{6}:[0-8]:[0-9a-f]{6}:[0-6]:[0-9a-f]{6}:[0-3]:[0-9a-f]{6}:[0-9a-f]{6})$' then
    raise exception 'escudo_invalido';
  end if;
  if escudo_ like 'v3:%' and lower(split_part(escudo_, ':', 2)) <> lower(btrim(nome_)) then
    raise exception 'escudo_invalido'; -- a escrita do emblema é sempre o nome do time
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
  if escudo_ !~ '^(v4:([1-9]|[1-3][0-9]|4[0-9])(:[0-9a-f]{6}){1,3}|v3:[A-Za-z0-9À-ÿ .&!''+-]{1,10}:([1-9]|1[01]):[0-9a-f]{6}:[0-9a-f]{6}:[0-8]:[0-9a-f]{6}:[0-6]:[0-9a-f]{6}:[0-3]:[0-9a-f]{6}:[0-9a-f]{6})$' or estilo_ not in ('classico', 'moderno', 'tecnologico') then
    raise exception 'dados_invalidos';
  end if;
  if escudo_ like 'v3:%' and lower(split_part(escudo_, ':', 2)) is distinct from (select lower(nome) from tc_orgs where user_id = uid) then
    raise exception 'dados_invalidos'; -- a escrita do emblema é sempre o nome do time
  end if;
  update tc_orgs set escudo = escudo_, cor1 = cor1_, cor2 = cor2_, estilo = estilo_ where user_id = uid;
  if not found then
    raise exception 'sem_org';
  end if;
end;
$$;
revoke all on function public.tc_personalizar_org(text, text, text, text) from public, anon;
grant execute on function public.tc_personalizar_org(text, text, text, text) to authenticated;


-- Conversão dos times antigos: o símbolo é escolhido pelo número do time, com as duas cores que o time já tinha.
update tc_orgs
   set escudo = 'v4:' || (1 + (id * 13) % 49)::text
              || ':' || case when cor1 ~ '^#[0-9a-fA-F]{6}$' then lower(substr(cor1, 2)) else '1b3a6b' end
              || ':' || case when cor2 ~ '^#[0-9a-fA-F]{6}$' then lower(substr(cor2, 2)) else 'd9a82b' end
 where escudo ~ '^(escudo-[0-9]+|v2:.*)$';
alter table tc_orgs alter column escudo set default 'v4:1:083871:12131d';

-- Times do sistema criados depois (a função que gera os rivais ainda grava escudo-N): o gatilho já grava no formato novo.
create or replace function public.tc_orgs_escudo_v4() returns trigger language plpgsql set search_path = public as $$
begin
  if new.escudo ~ '^(escudo-[0-9]+|v2:.*)$' then
    new.escudo := 'v4:' || (1 + (new.id * 13) % 49)::text
               || ':' || case when new.cor1 ~ '^#[0-9a-fA-F]{6}$' then lower(substr(new.cor1, 2)) else '1b3a6b' end
               || ':' || case when new.cor2 ~ '^#[0-9a-fA-F]{6}$' then lower(substr(new.cor2, 2)) else 'd9a82b' end;
  end if;
  return new;
end;
$$;
drop trigger if exists tc_orgs_escudo_v4 on tc_orgs;
create trigger tc_orgs_escudo_v4 before insert on tc_orgs for each row execute function public.tc_orgs_escudo_v4();
