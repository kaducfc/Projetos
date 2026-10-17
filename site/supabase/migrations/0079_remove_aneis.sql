-- Tira as molduras animadas em CSS que não foram aprovadas (Gelo, Galáxia, Tempestade, Sakura e Magma).
-- Quem estava com uma equipada volta a ficar sem moldura. Rodar de novo é seguro.
update public.site_profiles set moldura = null
 where moldura in ('fx-gelo', 'fx-galaxia', 'fx-tempestade', 'fx-sakura', 'fx-magma');
delete from public.site_recompensas
 where tipo = 'moldura' and chave in ('fx-gelo', 'fx-galaxia', 'fx-tempestade', 'fx-sakura', 'fx-magma');
