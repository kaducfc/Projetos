-- Trava servidor pra transcend_count nunca REGREDIR num upsert do cliente
-- (ver syncProfile em js/systems/pvp.js) — foi encontrado um caso real de
-- um save local perdendo o transcendCount (voltando a 0, provavelmente por
-- corrupção/perda do localStorage) e o próximo sync automático (ver
-- PVP_AUTO_SYNC_INTERVAL_MS em js/main.js) sobrescrevendo silenciosamente
-- o valor real (20) do servidor com 0. Diferente de hunter_level (que
-- LEGITIMAMENTE volta pra 1 a cada Transcender de verdade), transcend_count
-- só sobe — nunca existe um caso legítimo de ele diminuir vindo do cliente,
-- então travar isso no servidor é seguro e não bloqueia nenhum fluxo real.
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do painel Supabase
-- e rode uma vez. Seguro rodar de novo (create or replace + drop trigger
-- if exists antes de recriar).

create or replace function public.pvp_profiles_clamp_transcend_count()
returns trigger
language plpgsql
as $$
begin
  if new.transcend_count < old.transcend_count then
    new.transcend_count := old.transcend_count;
  end if;
  return new;
end;
$$;

drop trigger if exists pvp_profiles_clamp_transcend_count on public.pvp_profiles;

create trigger pvp_profiles_clamp_transcend_count
  before update on public.pvp_profiles
  for each row
  execute function public.pvp_profiles_clamp_transcend_count();
