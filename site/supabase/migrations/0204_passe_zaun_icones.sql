-- Passe Zaun e Piltover: três ícones de cenário (arte inteira dentro do círculo, sem fundo inventado) como recompensa.
--   nível 2  (grátis)   Cidade de Piltover   (exc-pl-cidade)
--   nível 10 (grátis)   Refinaria de Zaun    (exc-zn-refinaria)
--   nível 13 (premium)  Submundo de Zaun     (exc-zn-submundo)
-- Os administradores também ganham os três (para equipar no perfil durante o teste).
-- Rodar depois da 0203 (a que desfaz os ícones antigos). Rodar de novo é seguro.
update public.site_passe_niveis set tipo = 'icone', chave = 'exc-pl-cidade'     where passe = 'zaun-piltover-2026' and nivel = 2  and trilha = 'gratis';
update public.site_passe_niveis set tipo = 'icone', chave = 'exc-zn-refinaria'  where passe = 'zaun-piltover-2026' and nivel = 10 and trilha = 'gratis';
update public.site_passe_niveis set tipo = 'icone', chave = 'exc-zn-submundo'   where passe = 'zaun-piltover-2026' and nivel = 13 and trilha = 'premium';
insert into public.site_recompensas (user_id, tipo, chave, origem)
select a.user_id, 'icone', i.chave, 'admin' from public.site_admins a
 cross join (values ('exc-pl-cidade'), ('exc-zn-refinaria'), ('exc-zn-submundo')) as i(chave)
on conflict do nothing;
