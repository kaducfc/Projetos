// Edge Function "apoio-intl-webhook": avisos do Stripe e do PayPal (pagamento
// aprovado, recusado, estornado). Cada aviso é conferido antes de valer:
//   * Stripe: assinatura HMAC (segredo STRIPE_WEBHOOK_SECRET, whsec_...);
//   * PayPal: o próprio PayPal confere a assinatura (PAYPAL_WEBHOOK_ID).
//
// Endereços a cadastrar:
//   Stripe → https://<projeto>.supabase.co/functions/v1/apoio-intl-webhook?p=stripe
//            eventos: checkout.session.completed, checkout.session.async_payment_succeeded,
//                     checkout.session.async_payment_failed, charge.refunded
//   PayPal → https://<projeto>.supabase.co/functions/v1/apoio-intl-webhook?p=paypal
//            eventos: PAYMENT.CAPTURE.COMPLETED, PAYMENT.CAPTURE.REFUNDED, PAYMENT.CAPTURE.REVERSED
// Segredos: STRIPE_WEBHOOK_SECRET, PAYPAL_CLIENT_ID, PAYPAL_SECRET, PAYPAL_WEBHOOK_ID,
//           PAYPAL_AMBIENTE ('sandbox' para testar), USD_BRL, EUR_BRL.
// Na criação da função, DESLIGUE "Verify JWT" (Stripe e PayPal não mandam token).

const env = (k) => Deno.env.get(k) || '';
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');

async function assinaturaStripeOk(corpo: string, cab: string) {
  const segredo = env('STRIPE_WEBHOOK_SECRET');
  if (!segredo || !cab) return false;
  const partes = Object.fromEntries(cab.split(',').map((p) => p.split('=') as [string, string]));
  const t = Number(partes.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > 600) return false;
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const esperado = hex(await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(`${t}.${corpo}`)));
  return cab.split(',').some((p) => p.startsWith('v1=') && p.slice(3) === esperado);
}

Deno.serve(async (req) => {
  const ok = () => new Response('ok', { status: 200 });
  const SUPABASE_URL = env('SUPABASE_URL');
  const SERVICO = env('SUPABASE_SERVICE_ROLE_KEY');
  const cotacao = { USD: Number(env('USD_BRL')) || 5.5, EUR: Number(env('EUR_BRL')) || 6.3 } as Record<string, number>;
  const PP = env('PAYPAL_AMBIENTE') === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
  const brl = (valor: number, moeda: string) => (cotacao[moeda] ? Math.round(valor * cotacao[moeda] * 100) / 100 : null);

  const bruto = await req.text();
  let ev: any;
  try { ev = JSON.parse(bruto); } catch { return new Response('corpo invalido', { status: 400 }); }
  const prov = new URL(req.url).searchParams.get('p');

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

  // ---------------- Stripe ----------------
  if (prov === 'stripe') {
    if (!(await assinaturaStripeOk(bruto, req.headers.get('stripe-signature') || ''))) return new Response('assinatura', { status: 400 });
    const o = ev?.data?.object || {};
    if (/^checkout\.session\.(completed|async_payment_succeeded)$/.test(ev.type)) {
      if (o.payment_status !== 'paid') return ok(); // ainda pendente (ex.: débito bancário)
      const apoio = String(o.client_reference_id || '');
      if (!/^[0-9a-f-]{36}$/i.test(apoio)) return ok();
      return atualizar(`id=eq.${apoio}&origem=eq.stripe`, 'aprovado', {
        mp_payment_id: `st_${o.payment_intent}`, valor_pago: brl(Number(o.amount_total) / 100, String(o.currency).toUpperCase()),
      });
    }
    if (ev.type === 'checkout.session.async_payment_failed') {
      const apoio = String(o.client_reference_id || '');
      return /^[0-9a-f-]{36}$/i.test(apoio) ? atualizar(`id=eq.${apoio}&origem=eq.stripe`, 'recusado', {}) : ok();
    }
    if (ev.type === 'charge.refunded' && o.refunded === true) {
      return atualizar(`mp_payment_id=eq.st_${o.payment_intent}&origem=eq.stripe`, 'estornado', {});
    }
    return ok();
  }

  // ---------------- PayPal ----------------
  if (prov === 'paypal') {
    const tk = await (await fetch(`${PP}/v1/oauth2/token`, {
      method: 'POST',
      headers: { Authorization: `Basic ${btoa(`${env('PAYPAL_CLIENT_ID')}:${env('PAYPAL_SECRET')}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    })).json().catch(() => ({}));
    if (!tk.access_token) return new Response('paypal', { status: 502 });
    const h = (n: string) => req.headers.get(n) || '';
    const v = await fetch(`${PP}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tk.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_algo: h('paypal-auth-algo'), cert_url: h('paypal-cert-url'), transmission_id: h('paypal-transmission-id'),
        transmission_sig: h('paypal-transmission-sig'), transmission_time: h('paypal-transmission-time'),
        webhook_id: env('PAYPAL_WEBHOOK_ID'), webhook_event: ev,
      }),
    });
    if (!v.ok || (await v.json()).verification_status !== 'SUCCESS') return new Response('assinatura', { status: 400 });

    const r = ev.resource || {};
    if (ev.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const apoio = String(r.custom_id || '');
      if (!/^[0-9a-f-]{36}$/i.test(apoio)) return ok();
      return atualizar(`id=eq.${apoio}&origem=eq.paypal`, 'aprovado', {
        mp_payment_id: `pp_${r.id}`, valor_pago: brl(Number(r.amount?.value), String(r.amount?.currency_code)),
      });
    }
    if (ev.event_type === 'PAYMENT.CAPTURE.REFUNDED' || ev.event_type === 'PAYMENT.CAPTURE.REVERSED') {
      const cap = ev.event_type === 'PAYMENT.CAPTURE.REVERSED'
        ? String(r.id || '')
        : String((r.links || []).find((l: { rel: string }) => l.rel === 'up')?.href || '').split('/').pop();
      return cap ? atualizar(`mp_payment_id=eq.pp_${cap}&origem=eq.paypal`, 'estornado', {}) : ok();
    }
    return ok();
  }
  return ok();
});
