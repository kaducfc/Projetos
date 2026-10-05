// Edge Function "apoio-intl-webhook": avisos do Stripe (pagamento aprovado,
// recusado, estornado). Cada aviso é conferido pela assinatura HMAC antes de valer.
//
// Cadastre no Stripe (Developers → Webhooks) o endereço
//   https://<projeto>.supabase.co/functions/v1/apoio-intl-webhook
// com os eventos: checkout.session.completed, checkout.session.async_payment_succeeded,
//                 checkout.session.async_payment_failed, charge.refunded
// Segredos: STRIPE_WEBHOOK_SECRET (whsec_...), USD_BRL, EUR_BRL. Também confirma a compra do Passe Premium (passe-premium-criar).
// Na criação da função, DESLIGUE "Verify JWT" (o Stripe não manda token).

const env = (k) => Deno.env.get(k) || '';
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');

async function assinaturaStripeOk(corpo: string, cab: string) {
  const segredo = env('STRIPE_WEBHOOK_SECRET').trim().replace(/^["']|["']$/g, '');
  if (!segredo || !cab) { console.error('apoio-intl-webhook: falta STRIPE_WEBHOOK_SECRET ou o cabeçalho stripe-signature'); return false; }
  const partes = Object.fromEntries(cab.split(',').map((p) => p.split('=') as [string, string]));
  const t = Number(partes.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > 600) { console.error('apoio-intl-webhook: assinatura fora do prazo'); return false; }
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const esperado = hex(await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(`${t}.${corpo}`)));
  const ok = cab.split(',').some((p) => p.startsWith('v1=') && p.slice(3) === esperado);
  if (!ok) console.error('apoio-intl-webhook: assinatura não confere (STRIPE_WEBHOOK_SECRET é o whsec_ deste destino?)');
  return ok;
}

Deno.serve(async (req) => {
  const ok = () => new Response('ok', { status: 200 });
  const SUPABASE_URL = env('SUPABASE_URL');
  const SERVICO = env('SUPABASE_SERVICE_ROLE_KEY');
  const cotacao = { USD: Number(env('USD_BRL')) || 5.5, EUR: Number(env('EUR_BRL')) || 6.3 } as Record<string, number>;
  const brl = (valor: number, moeda: string) => (cotacao[moeda] ? Math.round(valor * cotacao[moeda] * 100) / 100 : null);

  const bruto = await req.text();
  let ev: any;
  try { ev = JSON.parse(bruto); } catch { return new Response('corpo invalido', { status: 400 }); }

  // Compra do Passe Premium (client_reference_id "passe_<id>"): liga/desliga o premium no banco.
  const passe = async (cid: string | null, status: string, pag: string) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/site_passe_confirmar_compra`, {
      method: 'POST',
      headers: { apikey: SERVICO, Authorization: `Bearer ${SERVICO}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cid, novo_status: status, pag }),
    });
    return r.ok ? ok() : new Response('erro no banco', { status: 500 });
  };

  const atualizar = async (filtro: string, status: string, extra: Record<string, unknown>) => {
    // Avisos chegam fora de ordem: "recusado"/"pendente" não desfaz uma aprovação;
    // estorno só vale para o pagamento que foi aprovado.
    const cond = status === 'aprovado' ? '' : status === 'estornado' ? '&status=eq.aprovado' : '&status=not.in.(aprovado,estornado)';
    const r = await fetch(`${SUPABASE_URL}/rest/v1/site_apoios?${filtro}${cond}`, {
      method: 'PATCH',
      headers: { apikey: SERVICO, Authorization: `Bearer ${SERVICO}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, atualizado: new Date().toISOString(), ...extra }),
    });
    return r.ok ? ok() : new Response('erro no banco', { status: 500 });
  };

  if (!(await assinaturaStripeOk(bruto, req.headers.get('stripe-signature') || ''))) return new Response('assinatura', { status: 400 });
  const o = ev?.data?.object || {};
  if (/^checkout\.session\.(completed|async_payment_succeeded)$/.test(ev.type)) {
    if (o.payment_status !== 'paid') return ok(); // ainda pendente (ex.: débito bancário)
    const apoio = String(o.client_reference_id || '');
    const compra = /^passe_([0-9a-f-]{36})$/i.exec(apoio);
    if (compra) return passe(compra[1], 'aprovado', `st_${o.payment_intent}`);
    if (!/^[0-9a-f-]{36}$/i.test(apoio)) return ok();
    return atualizar(`id=eq.${apoio}&origem=eq.stripe`, 'aprovado', {
      mp_payment_id: `st_${o.payment_intent}`, valor_pago: brl(Number(o.amount_total) / 100, String(o.currency).toUpperCase()),
    });
  }
  if (ev.type === 'checkout.session.async_payment_failed') {
    const apoio = String(o.client_reference_id || '');
    const compra = /^passe_([0-9a-f-]{36})$/i.exec(apoio);
    if (compra) return passe(compra[1], 'recusado', '');
    return /^[0-9a-f-]{36}$/i.test(apoio) ? atualizar(`id=eq.${apoio}&origem=eq.stripe`, 'recusado', {}) : ok();
  }
  if (ev.type === 'charge.refunded' && o.refunded === true) {
    await passe(null, 'estornado', `st_${o.payment_intent}`); // se for compra do passe
    return atualizar(`mp_payment_id=eq.st_${o.payment_intent}&origem=eq.stripe`, 'estornado', {});
  }
  return ok();
});
