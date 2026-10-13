-- Versões animadas (em teste) do Vampiro (hw-moldura-1) e de Abóboras e Espinhos (hw-moldura-2):
-- ficam só na aba Teste do painel e na conta dos administradores. As molduras do passe continuam como estão.
-- Rodar de novo é seguro.
insert into public.site_recompensas (user_id, tipo, chave, origem)
select a.user_id, 'moldura', m.chave, 'admin'
  from public.site_admins a
 cross join (values ('hw-moldura-1-fx'), ('hw-moldura-2-fx')) as m(chave)
on conflict do nothing;
