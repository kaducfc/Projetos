-- Nomes oficiais dos campeonatos do Simulador de Técnico (Série B, Série A e os dois internacionais).
-- Atualiza a configuração e renomeia as ligas que já existem (o nome é guardado em cada liga). Rode depois da 0118; pode rodar de novo.
update public.tc_config
   set valor = jsonb_build_object('acesso', 'Liga Academy', 'principal', 'Liga Nacional', 'copa', 'Copa Internacional', 'mundial', 'Campeonato Mundial')
 where chave = 'nomes';

-- Ligas já criadas: troca só o prefixo do nome, mantendo o sufixo ("· S1 semana 2" etc.).
update public.tc_ligas set nome = regexp_replace(nome, '^(Liga Ascensão|Liga Academy)', 'Liga Academy')
 where tipo = 'divisao' and divisao = 'acesso';
update public.tc_ligas set nome = regexp_replace(nome, '^(Liga Apex Nacional|Liga Nacional)', 'Liga Nacional')
 where tipo = 'divisao' and divisao = 'principal';
update public.tc_ligas set nome = regexp_replace(nome, '^(Copa dos Convergentes|Copa Internacional)', 'Copa Internacional')
 where tipo = 'copa';
update public.tc_ligas set nome = regexp_replace(nome, '^(Campeonato Mundial das Lendas|Campeonato Mundial)', 'Campeonato Mundial')
 where tipo = 'mundial';
