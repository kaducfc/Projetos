-- Moldura de teste "Correntes e Caveiras" (hw-moldura-3): liberada para as contas de
-- administrador e recompensa do nível 9 do passe Halloween 2026 (premium).
-- Também: nível 14 = ícone exclusivo "Abóbora Sombria" (grátis).
-- Só troca o nível se ainda for moeda. Rodar de novo é seguro.
insert into public.site_recompensas (user_id, tipo, chave, origem)
select a.user_id, 'moldura', 'hw-moldura-3', 'admin' from public.site_admins a
on conflict do nothing;
update public.site_passe_niveis set tipo = 'moldura', chave = 'hw-moldura-3'
 where passe = 'halloween-2026' and nivel = 9 and tipo = 'moeda';
update public.site_passe_niveis set tipo = 'icone', chave = 'exc-abobora-sombria'
 where passe = 'halloween-2026' and nivel = 14 and tipo = 'moeda';
