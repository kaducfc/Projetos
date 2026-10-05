// Edge Function "apoio-webhook": o Mercado Pago avisa aqui quando um
// pagamento muda (aprovado, recusado, estornado...). A notificação em si não
// é confiável: buscamos o pagamento direto na API do Mercado Pago com o
// nosso Access Token e só então atualizamos a doação (o total apoiado da
// conta é recalculado pelo banco).
//
// Segredos: MP_ACCESS_TOKEN (o mesmo da apoio-criar).
// Na criação da função, DESLIGUE "Verify JWT" (o Mercado Pago não manda token).

const STATUS = {
  approved: 'aprovado',
  authorized: 'pendente',
  pending: 'pendente',
  in_process: 'pendente',
  in_mediation: 'pendente',
  rejected: 'recusado',
  cancelled: 'cancelado',
  refunded: 'estornado',
  charged_back: 'estornado',
};

Deno.serve(async (req) => {
  const ok = () => new Response('ok', { status: 200 });
  const env = (k) => Deno.env.get(k) || '';
  const SUPABASE_URL = env('SUPABASE_URL');
  const SERVICO = env('SUPABASE_SERVICE_ROLE_KEY');
  const MP = env('MP_ACCESS_TOKEN');

  const url = new URL(req.url);
  let corpo = {};
  try { corpo = await req.json(); } catch { /* aviso sem corpo */ }
  const tipo = url.searchParams.get('type') || url.searchParams.get('topic') || corpo.type || corpo.topic || '';
  const id = url.searchParams.get('data.id') || corpo?.data?.id || (tipo === 'payment' ? url.searchParams.get('id') : '') || '';
  // Só interessam avisos de pagamento; o resto é confirmado e ignorado.
  if (!/payment/.test(tipo) || !/^\d+$/.test(String(id))) return ok();

  const r = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, { headers: { Authorization: `Bearer ${MP}` } });
  if (!r.ok) return new Response('pagamento nao encontrado', { status: 502 }); // o Mercado Pago tenta de novo
  const pg = await r.json();
  const apoioId = String(pg.external_reference || '');
  // Compra do Passe Premium: external_reference "passe_<id da compra>".
  const compra = /^passe_([0-9a-f-]{36})$/i.exec(apoioId);
  if (compra) {
    const r2 = await fetch(`${SUPABASE_URL}/rest/v1/rpc/site_passe_confirmar_compra`, {
      method: 'POST',
      headers: { apikey: SERVICO, Authorization: `Bearer ${SERVICO}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cid: compra[1], novo_status: STATUS[pg.status] || 'pendente', pag: `mp_${pg.id}` }),
    });
    return r2.ok ? ok() : new Response('erro no banco', { status: 500 });
  }
  if (!/^[0-9a-f-]{36}$/i.test(apoioId)) return ok();

  const status = STATUS[pg.status] || 'pendente';
  const valorPago = pg.currency_id === 'BRL' ? Number(pg.transaction_amount) : null;
  // Avisos podem chegar fora de ordem: um "recusado" ou "pendente" antigo não
  // desfaz uma aprovação; estorno só vale para o pagamento que foi aprovado.
  const filtro = status === 'aprovado' ? ''
    : status === 'estornado' ? `&mp_payment_id=eq.${pg.id}`
      : '&status=not.in.(aprovado,estornado)';
  const up = await fetch(`${SUPABASE_URL}/rest/v1/site_apoios?id=eq.${apoioId}${filtro}`, {
    method: 'PATCH',
    headers: { apikey: SERVICO, Authorization: `Bearer ${SERVICO}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, mp_payment_id: String(pg.id), valor_pago: valorPago, atualizado: new Date().toISOString() }),
  });
  if (!up.ok) return new Response('erro no banco', { status: 500 });
  return ok();
});
