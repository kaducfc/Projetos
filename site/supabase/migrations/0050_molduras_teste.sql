-- Molduras de teste "Morcegos e Rubi" (hw-moldura-1) e "Abóboras e Espinhos" (hw-moldura-2)
-- liberadas para as contas de administrador; troca a moldura de demonstração (hw-teste).
-- Rodar de novo é seguro.
delete from public.site_recompensas where tipo = 'moldura' and chave = 'hw-teste';
update public.site_profiles set moldura = null where moldura = 'hw-teste';
insert into public.site_recompensas (user_id, tipo, chave, origem)
select a.user_id, 'moldura', m.chave, 'admin'
  from public.site_admins a cross join (values ('hw-moldura-1'), ('hw-moldura-2')) as m(chave)
on conflict do nothing;
