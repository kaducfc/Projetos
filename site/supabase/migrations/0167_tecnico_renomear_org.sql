-- Simulador de Técnico: trocar o nome do time (Configuração), por 200 Rift Coins. Rode depois do 0166. Idempotente.
--  * Mesmas regras do nome na criação (3 a 24 caracteres, único sem diferenciar maiúsculas); o nome novo tem de ser diferente do atual.
--  * Quem usa o emblema só de escrita (v3) tem a escrita atualizada para o nome novo; se o nome novo não couber (mais de 14 caracteres ou
--    símbolos não permitidos), o time passa a usar um símbolo e mantém as cores.
--  * O saldo insuficiente desfaz tudo (nada muda).

create or replace function public.tc_renomear_org(nome_ text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  n text := regexp_replace(trim(coalesce(nome_, '')), '\s+', ' ', 'g');
  o tc_orgs%rowtype;
  novo_escudo text;
  saldo_novo bigint;
  custo constant bigint := 200;
begin
  perform tc_exigir(uid);
  if char_length(n) < 3 or char_length(n) > 24 or n !~ '^[[:alnum:] ._''-]+$' then
    raise exception 'nome_invalido';
  end if;
  select * into o from tc_orgs where user_id = uid for update;
  if o.id is null then raise exception 'sem_org'; end if;
  if n = o.nome then raise exception 'nome_igual'; end if;
  if exists (select 1 from tc_orgs where lower(nome) = lower(n) and id <> o.id) then
    raise exception 'nome_em_uso';
  end if;
  novo_escudo := o.escudo;
  if o.escudo like 'v3:%' then
    if char_length(n) <= 14 and n ~ '^[A-Za-z0-9À-ÿ .&!''+-]+$' then
      novo_escudo := 'v3:' || n || substr(o.escudo, char_length('v3:' || split_part(o.escudo, ':', 2)) + 1);
    else
      novo_escudo := 'v4:' || (1 + (o.id * 13) % 49)::text
                  || ':' || case when o.cor1 ~ '^#[0-9a-fA-F]{6}$' then lower(substr(o.cor1, 2)) else '1b3a6b' end;
    end if;
  end if;
  saldo_novo := site_moedas_mexer(uid, -custo, 'tecnico_renomear', left(o.nome || ' > ' || n, 200)); -- falta de saldo desfaz tudo
  update tc_orgs set nome = n, escudo = novo_escudo where id = o.id;
  return jsonb_build_object('ok', true, 'nome', n, 'escudo', novo_escudo, 'custo_rc', custo, 'saldo_rc', saldo_novo);
exception when unique_violation then
  raise exception 'nome_em_uso';
end;
$$;
revoke all on function public.tc_renomear_org(text) from public, anon;
grant execute on function public.tc_renomear_org(text) to authenticated;
