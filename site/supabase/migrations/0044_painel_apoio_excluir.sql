-- Painel, aba Apoio: o administrador pode excluir um pagamento que NÃO foi concluído
-- (aguardando, recusado ou cancelado), seja doação ou compra do Passe Premium.
-- Pagamentos aprovados ou estornados não podem ser excluídos (são histórico financeiro).
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e clique em Run.
-- Rodar de novo é seguro.

create or replace function public.site_admin_apoio_excluir(p_tipo text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if not coalesce(site_is_admin(), false) then
    raise exception 'not_admin';
  end if;
  if p_tipo = 'passe' then
    delete from site_passe_compras where id = p_id and status in ('pendente', 'recusado', 'cancelado');
  elsif p_tipo = 'doacao' then
    delete from site_apoios where id = p_id and status in ('pendente', 'recusado', 'cancelado');
  else
    raise exception 'tipo_invalido';
  end if;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'nao_excluivel';
  end if;
end;
$$;
revoke all on function public.site_admin_apoio_excluir(text, uuid) from public, anon;
grant execute on function public.site_admin_apoio_excluir(text, uuid) to authenticated;
