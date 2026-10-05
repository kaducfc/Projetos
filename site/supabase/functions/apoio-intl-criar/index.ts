// Edge Function "apoio-intl-criar": apoio internacional (fora do Brasil) por
// Stripe (cartão, Apple Pay, Google Pay) ou PayPal, em dólar ou euro.
//
//   { provedor: 'stripe' | 'paypal', valor, moeda: 'USD' | 'EUR' }
//       → { url }   (a pessoa é levada ao Stripe ou ao PayPal para pagar)
//   { acao: 'capturar', order }
//       → { status } (PayPal: confirma o pedido quando a pessoa volta ao site)
//
// Segredos (Supabase → Edge Functions → Secrets):
//   STRIPE_SECRET_KEY    sk_live_...   (só para o Stripe)
//   PAYPAL_CLIENT_ID, PAYPAL_SECRET    (só para o PayPal)
//   PAYPAL_AMBIENTE      'live' (padrão) ou 'sandbox' para testar
//   USD_BRL, EUR_BRL     cotação usada só para somar o total apoiado (padrão 5.5 e 6.3)
//   SITE_URL             https://riftarcade.com.br  (opcional)
// Na criação da função, DESLIGUE "Verify JWT": a conta é conferida aqui.

const MINIMO = 3;
const MAXIMO = 10000;
const MOEDAS = ['USD', 'EUR'];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const resposta = (corpo, status = 200) => new Response(JSON.stringify(corpo), {
  status, headers: { ...CORS, 'Content-Type': 'application/json' },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return resposta({ erro: 'metodo' }, 405);

  const env = (k) => Deno.env.get(k) || '';
  const SUPABASE_URL = env('SUPABASE_URL');
  const ANON = env('SUPABASE_ANON_KEY');
  const SERVICO = env('SUPABASE_SERVICE_ROLE_KEY');
  const SITE = env('SITE_URL') || 'https://riftarcade.com.br';
  const cotacao = { USD: Number(env('USD_BRL')) || 5.5, EUR: Number(env('EUR_BRL')) || 6.3 };
  const PP = env('PAYPAL_AMBIENTE') === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';

  // Quem está pedindo (token da sessão do site).
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const quem = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
  if (!quem.ok) return resposta({ erro: 'nao_logado' }, 401);
  const user = await quem.json();

  const rest = (caminho, init = {}) => fetch(`${SUPABASE_URL}/rest/v1/${caminho}`, {
    ...init,
    headers: { apikey: SERVICO, Authorization: `Bearer ${SERVICO}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers || {}) },
  });
  const tokenPaypal = async () => {
    const r = await fetch(`${PP}/v1/oauth2/token`, {
      method: 'POST',
      headers: { Authorization: `Basic ${btoa(`${env('PAYPAL_CLIENT_ID')}:${env('PAYPAL_SECRET')}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    });
    if (!r.ok) { console.error('apoio-intl-criar: paypal token', await r.text()); return ''; }
    return (await r.json()).access_token as string;
  };

  let corpo: Record<string, unknown>;
  try { corpo = await req.json(); } catch { return resposta({ erro: 'valor_invalido' }, 400); }

  // ---- PayPal: a pessoa voltou ao site, confirma (captura) o pedido ----
  if (corpo.acao === 'capturar') {
    const order = String(corpo.order || '');
    if (!/^[A-Z0-9]{8,30}$/.test(order)) return resposta({ erro: 'pedido_invalido' }, 400);
    const busca = await rest(`site_apoios?select=id,status,moeda&origem=eq.paypal&ext_id=eq.${order}&user_id=eq.${user.id}`);
    const [apoio] = busca.ok ? await busca.json() : [];
    if (!apoio) return resposta({ erro: 'pedido_nao_encontrado' }, 404);
    if (apoio.status === 'aprovado') return resposta({ status: 'aprovado' });
    const tk = await tokenPaypal();
    if (!tk) return resposta({ erro: 'paypal' }, 502);
    let r = await fetch(`${PP}/v2/checkout/orders/${order}/capture`, {
      method: 'POST', headers: { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json', 'PayPal-Request-Id': `cap-${apoio.id}` }, body: '{}',
    });
    // Já capturado (ex.: o aviso do PayPal chegou antes): só lê o pedido.
    if (!r.ok) r = await fetch(`${PP}/v2/checkout/orders/${order}`, { headers: { Authorization: `Bearer ${tk}` } });
    if (!r.ok) { console.error('apoio-intl-criar: paypal captura', await r.text()); return resposta({ erro: 'paypal' }, 502); }
    const pedido = await r.json();
    const cap = pedido?.purchase_units?.[0]?.payments?.captures?.[0];
    if (pedido.status !== 'COMPLETED' || !cap || cap.status !== 'COMPLETED') return resposta({ status: 'pendente' });
    const moeda = String(cap.amount?.currency_code || '');
    if (!MOEDAS.includes(moeda)) return resposta({ erro: 'moeda' }, 502);
    const brl = Math.round(Number(cap.amount.value) * cotacao[moeda as 'USD' | 'EUR'] * 100) / 100;
    await rest(`site_apoios?id=eq.${apoio.id}&status=not.in.(aprovado,estornado)`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'aprovado', mp_payment_id: `pp_${cap.id}`, valor_pago: brl, atualizado: new Date().toISOString() }),
    });
    return resposta({ status: 'aprovado' });
  }

  // ---- Criar o pagamento ----
  const provedor = String(corpo.provedor || '');
  const moeda = String(corpo.moeda || '').toUpperCase();
  const valor = Math.round(Number(corpo.valor) * 100) / 100;
  if (!['stripe', 'paypal'].includes(provedor)) return resposta({ erro: 'provedor' }, 400);
  if (!MOEDAS.includes(moeda)) return resposta({ erro: 'moeda' }, 400);
  if (!Number.isFinite(valor) || valor < MINIMO || valor > MAXIMO) return resposta({ erro: 'valor_invalido' }, 400);
  if (provedor === 'stripe' && !env('STRIPE_SECRET_KEY')) return resposta({ erro: 'stripe_nao_configurado' }, 503);
  if (provedor === 'paypal' && !(env('PAYPAL_CLIENT_ID') && env('PAYPAL_SECRET'))) return resposta({ erro: 'paypal_nao_configurado' }, 503);

  // Contra robô: no máximo 10 pagamentos abertos por conta a cada hora.
  const umaHora = new Date(Date.now() - 3600_000).toISOString();
  const recentes = await rest(`site_apoios?select=id&user_id=eq.${user.id}&criado=gte.${umaHora}&limit=10`);
  if (recentes.ok && (await recentes.json()).length >= 10) return resposta({ erro: 'muitos_pedidos' }, 429);

  const brl = Math.round(valor * cotacao[moeda as 'USD' | 'EUR'] * 100) / 100;
  const novo = await rest('site_apoios', {
    method: 'POST',
    body: JSON.stringify({ user_id: user.id, valor: brl, origem: provedor, moeda, valor_original: valor }),
  });
  if (!novo.ok) {
    console.error('apoio-intl-criar: banco', await novo.text());
    return resposta({ erro: 'banco' }, 500);
  }
  const [apoio] = await novo.json();
  const cancelar = () => rest(`site_apoios?id=eq.${apoio.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelado', atualizado: new Date().toISOString() }) });
  const volta = (status: string) => `${SITE}/apoiar/?status=${status}&apoio=${apoio.id}&via=${provedor}`;

  if (provedor === 'stripe') {
    const f = new URLSearchParams({
      mode: 'payment',
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': moeda.toLowerCase(),
      'line_items[0][price_data][unit_amount]': String(Math.round(valor * 100)),
      'line_items[0][price_data][product_data][name]': 'Rift Arcade support',
      'line_items[0][price_data][product_data][description]': 'Voluntary support (cosmetics only, no advantage in the games)',
      client_reference_id: apoio.id,
      'metadata[apoio]': apoio.id,
      'payment_intent_data[metadata][apoio]': apoio.id,
      success_url: volta('aprovado'),
      cancel_url: volta('falhou'),
    });
    const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env('STRIPE_SECRET_KEY')}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': apoio.id },
      body: f,
    });
    if (!r.ok) { console.error('apoio-intl-criar: stripe', await r.text()); await cancelar(); return resposta({ erro: 'stripe' }, 502); }
    const s = await r.json();
    await rest(`site_apoios?id=eq.${apoio.id}`, { method: 'PATCH', body: JSON.stringify({ ext_id: s.id }) });
    return resposta({ url: s.url, apoio: apoio.id });
  }

  const tk = await tokenPaypal();
  if (!tk) { await cancelar(); return resposta({ erro: 'paypal' }, 502); }
  const r = await fetch(`${PP}/v2/checkout/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json', 'PayPal-Request-Id': apoio.id },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: apoio.id,
        custom_id: apoio.id,
        description: 'Rift Arcade support',
        amount: { currency_code: moeda, value: valor.toFixed(2) },
      }],
      application_context: { brand_name: 'Rift Arcade', user_action: 'PAY_NOW', shipping_preference: 'NO_SHIPPING', return_url: volta('aprovado'), cancel_url: volta('falhou') },
    }),
  });
  if (!r.ok) { console.error('apoio-intl-criar: paypal pedido', await r.text()); await cancelar(); return resposta({ erro: 'paypal' }, 502); }
  const p = await r.json();
  const link = (p.links || []).find((l: { rel: string }) => l.rel === 'approve' || l.rel === 'payer-action')?.href;
  if (!link) { await cancelar(); return resposta({ erro: 'paypal' }, 502); }
  await rest(`site_apoios?id=eq.${apoio.id}`, { method: 'PATCH', body: JSON.stringify({ ext_id: p.id }) });
  return resposta({ url: link, apoio: apoio.id });
});
