-- Vampiro (hw-moldura-1) e Abóboras e Espinhos (hw-moldura-2) passam a ser animadas para todo mundo
-- (a mudança é só no site: quem já tem a moldura ganha a animação sozinho). Aqui só se limpam as
-- versões de teste (-fx) do 0082, que deixaram de existir. Rodar de novo é seguro.
update public.site_profiles set moldura = replace(moldura, '-fx', '') where moldura in ('hw-moldura-1-fx', 'hw-moldura-2-fx');
delete from public.site_recompensas where tipo = 'moldura' and chave in ('hw-moldura-1-fx', 'hw-moldura-2-fx');
