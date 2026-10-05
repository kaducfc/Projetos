// Edge Function "apoio-intl-criar": apoio internacional (fora do Brasil) pelo
// Stripe Checkout (cartão, Apple Pay, Google Pay), em dólar ou euro.
//
//   { valor, moeda: 'USD' | 'EUR' }  →  { url }  (a pessoa é levada ao Stripe para pagar)
//
// Segredos (Supabase → Edge Functions → Secrets):
//   STRIPE_SECRET_KEY  sk_live_... (ou sk_test_... para testar)
//   USD_BRL, EUR_BRL   cotação usada só para somar o total apoiado (padrão 5.5 e 6.3)
//   SITE_URL           https://riftarcade.com.br  (opcional)
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
  const STRIPE = env('STRIPE_SECRET_KEY');
  const SITE = env('SITE_URL') || 'https://riftarcade.com.br';
  const cotacao: Record<string, number> = { USD: Number(env('USD_BRL')) || 5.5, EUR: Number(env('EUR_BRL')) || 6.3 };
  if (!STRIPE) return resposta({ erro: 'stripe_nao_configurado' }, 503);

  // Quem está pedindo (token da sessão do site).
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const quem = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
  if (!quem.ok) return resposta({ erro: 'nao_logado' }, 401);
  const user = await quem.json();

  let corpo: Record<string, unknown>;
  try { corpo = await req.json(); } catch { return resposta({ erro: 'valor_invalido' }, 400); }
  const moeda = String(corpo.moeda || '').toUpperCase();
  const valor = Math.round(Number(corpo.valor) * 100) / 100;
  if (!MOEDAS.includes(moeda)) return resposta({ erro: 'moeda' }, 400);
  if (!Number.isFinite(valor) || valor < MINIMO || valor > MAXIMO) return resposta({ erro: 'valor_invalido' }, 400);

  const rest = (caminho, init = {}) => fetch(`${SUPABASE_URL}/rest/v1/${caminho}`, {
    ...init,
    headers: { apikey: SERVICO, Authorization: `Bearer ${SERVICO}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers || {}) },
  });

  // Contra robô: no máximo 10 pagamentos abertos por conta a cada hora.
  const umaHora = new Date(Date.now() - 3600_000).toISOString();
  const recentes = await rest(`site_apoios?select=id&user_id=eq.${user.id}&criado=gte.${umaHora}&limit=10`);
  if (recentes.ok && (await recentes.json()).length >= 10) return resposta({ erro: 'muitos_pedidos' }, 429);

  // 1) Registra a doação pendente (em reais, só para somar; o valor real fica em valor_original).
  const brl = Math.round(valor * cotacao[moeda] * 100) / 100;
  const novo = await rest('site_apoios', {
    method: 'POST',
    body: JSON.stringify({ user_id: user.id, valor: brl, origem: 'stripe', moeda, valor_original: valor }),
  });
  if (!novo.ok) {
    console.error('apoio-intl-criar: banco', await novo.text()); // detalhe só no log do Supabase
    return resposta({ erro: 'banco' }, 500);
  }
  const [apoio] = await novo.json();

  // 2) Cria a sessão de pagamento no Stripe.
  const volta = (status: string) => `${SITE}/apoiar/?status=${status}&apoio=${apoio.id}`;
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
    headers: { Authorization: `Bearer ${STRIPE}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': apoio.id },
    body: f,
  });
  if (!r.ok) {
    console.error('apoio-intl-criar: stripe', await r.text());
    await rest(`site_apoios?id=eq.${apoio.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelado', atualizado: new Date().toISOString() }) });
    return resposta({ erro: 'stripe' }, 502);
  }
  const s = await r.json();
  await rest(`site_apoios?id=eq.${apoio.id}`, { method: 'PATCH', body: JSON.stringify({ ext_id: s.id }) });
  return resposta({ url: s.url, apoio: apoio.id });
});
