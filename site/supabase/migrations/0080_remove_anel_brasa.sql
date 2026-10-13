-- Tira o Anel de Brasa (moldura animada em CSS reprovada). Quem estava com ele equipado fica sem moldura.
-- Rodar de novo é seguro.
update public.site_profiles set moldura = null where moldura = 'fx-brasa';
delete from public.site_recompensas where tipo = 'moldura' and chave = 'fx-brasa';
