-- Simulador de Técnico: posições padrão dos campeões ajustadas à mão.
-- Idempotente. Para corrigir um campeão: edite a lista abaixo (uma linha por campeão) e rode ESTE arquivo de novo.
-- Rode-o também sempre que reexecutar 0090 (que volta as posições do catálogo original).
--
--   id:        nome do campeão em minúsculas, sem espaços/acentos/símbolos (o mesmo id de tc_campeoes: 'naafiri', 'leesin', 'kaisa'...)
--   posições:  top, selva, meio, atirador, suporte (uma ou mais; a primeira é a principal)
--
-- Para consultar os ids/posições atuais:  select id, nome, posicoes from tc_campeoes order by nome;

do $$
declare
  ajustes constant jsonb := '{
    "naafiri": ["selva"]
  }'::jsonb;
  k text;
  p jsonb;
  validas constant text[] := array['top', 'selva', 'meio', 'atirador', 'suporte'];
begin
  for k, p in select * from jsonb_each(ajustes) loop
    if jsonb_typeof(p) <> 'array' or jsonb_array_length(p) = 0
       or exists (select 1 from jsonb_array_elements_text(p) e where e <> all (validas)) then
      raise exception 'posições inválidas para %: use top, selva, meio, atirador ou suporte', k;
    end if;
    update tc_campeoes set posicoes = array(select jsonb_array_elements_text(p)) where id = k;
    if not found then raise exception 'campeão "%" não existe em tc_campeoes (confira o id com: select id, nome from tc_campeoes)', k; end if;
  end loop;
end $$;
