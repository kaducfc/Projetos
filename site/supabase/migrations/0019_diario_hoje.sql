-- Página inicial: situação de hoje no Runetermo e no Campeão Oculto, só
-- para leitura (não abre partida nem sorteia resposta). Rodar depois da 0018.

create or replace function public.site_diario_hoje()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_object_agg(d.jogo, jsonb_build_object(
           'status', d.status,
           'chutes', jsonb_array_length(d.chutes),
           'tentativas', jsonb_array_length(d.chutes) + case when d.jogo = 'campeao' then jsonb_array_length(d.dicas) else 0 end,
           'pdr', d.pdr)), '{}'::jsonb)
    from site_diario d
   where d.user_id = auth.uid() and d.dia = site_hoje_br();
$$;
revoke all on function public.site_diario_hoje() from public, anon;
grant execute on function public.site_diario_hoje() to authenticated;
