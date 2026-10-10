// Edge Function "rc-comprar-criar": venda de Rift Coins (RC) por dinheiro.
//   { acao: 'precos' }                                   → tabela de preços (BRL, USD e EUR)
//   { pacote: 1000|3000|5000|10000, provedor: 'mercadopago' }               → Mercado Pago, em reais
//   { pacote, provedor: 'stripe', moeda: 'USD' | 'EUR' }                    → Stripe
// Os preços são decididos AQUI (o site só escolhe pacote, provedor e moeda). Em euro, o
// valor é o preço em dólar convertido pelas cotações USD_BRL e EUR_BRL (arredondado a
// R$ 0,10 do euro). Devolve { url } para onde a pessoa vai pagar; a confirmação chega pelos
// webhooks (apoio-webhook e apoio-intl-webhook) que chamam site_rc_confirmar_compra.
//
// Segredos: MP_ACCESS_TOKEN, STRIPE_SECRET_KEY, USD_BRL, EUR_BRL, SITE_URL (opcional).
// Na criação da função, DESLIGUE "Verify JWT": a conta é conferida aqui.

// rc → { BRL, USD }
const PACOTES: Record<number, { BRL: number; USD: number }> = {
  1000: { BRL: 10, USD: 7 },
  3000: { BRL: 25, USD: 17 },
  5000: { BRL: 40, USD: 27 },
  10000: { BRL: 70, USD: 47 },
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const resposta = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), {
  status, headers: { ...CORS, 'Content-Type': 'application/json' },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return resposta({ erro: 'metodo' }, 405);

  const env = (k: string) => Deno.env.get(k) || '';
  const SUPABASE_URL = env('SUPABASE_URL');
  const ANON = env('SUPABASE_ANON_KEY');
  const SERVICO = env('SUPABASE_SERVICE_ROLE_KEY');
  const SITE = env('SITE_URL') || 'https://riftarcade.com.br';
  const usdBrl = Number(env('USD_BRL')) || 5.5;
  const eurBrl = Number(env('EUR_BRL')) || 6.3;
  const preco = (rc: number, moeda: string) => {
    const p = PACOTES[rc];
    if (!p) return null;
    if (moeda === 'BRL') return p.BRL;
    if (moeda === 'USD') return p.USD;
    return Math.round((p.USD * usdBrl / eurBrl) * 10) / 10; // EUR
  };

  let corpo: Record<string, unknown>;
  try { corpo = await req.json(); } catch { return resposta({ erro: 'pedido_invalido' }, 400); }

  if (corpo.acao === 'precos') {
    const tabela: Record<string, Record<string, number | null>> = { BRL: {}, USD: {}, EUR: {} };
    for (const rc of Object.keys(PACOTES)) for (const m of Object.keys(tabela)) tabela[m][rc] = preco(Number(rc), m);
    return resposta({ precos: tabela });
  }

  const rcQtd = Number(corpo.pacote);
  const provedor = String(corpo.provedor || '');
  const moeda = provedor === 'mercadopago' ? 'BRL' : String(corpo.moeda || '').toUpperCase();
  if (!PACOTES[rcQtd]) return resposta({ erro: 'pacote' }, 400);
  if (provedor !== 'mercadopago' && provedor !== 'stripe') return resposta({ erro: 'provedor' }, 400);
  if (!['BRL', 'USD', 'EUR'].includes(moeda) || (provedor === 'stripe' && moeda === 'BRL')) return resposta({ erro: 'moeda' }, 400);
  if (provedor === 'mercadopago' && !env('MP_ACCESS_TOKEN')) return resposta({ erro: 'mp_nao_configurado' }, 503);
  if (provedor === 'stripe' && !env('STRIPE_SECRET_KEY')) return resposta({ erro: 'stripe_nao_configurado' }, 503);
  const valor = preco(rcQtd, moeda) as number;
  const valorBrl = moeda === 'BRL' ? valor : Math.round(valor * (moeda === 'USD' ? usdBrl : eurBrl) * 100) / 100;

  // Quem está pedindo (token da sessão do site).
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const quem = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
  if (!quem.ok) return resposta({ erro: 'nao_logado' }, 401);
  const user = await quem.json();

  const rest = (caminho: string, init: RequestInit = {}) => fetch(`${SUPABASE_URL}/rest/v1/${caminho}`, {
    ...init,
    headers: { apikey: SERVICO, Authorization: `Bearer ${SERVICO}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers || {}) },
  });

  // Contra robô: no máximo 10 pedidos abertos por conta a cada hora.
  const umaHora = new Date(Date.now() - 3600_000).toISOString();
  const recentes = await rest(`site_rc_compras?select=id&user_id=eq.${user.id}&criado=gte.${umaHora}&limit=10`);
  if (recentes.ok && (await recentes.json()).length >= 10) return resposta({ erro: 'muitos_pedidos' }, 429);

  const novo = await rest('site_rc_compras', {
    method: 'POST',
    body: JSON.stringify({ user_id: user.id, rc: rcQtd, provedor, moeda, valor, valor_brl: valorBrl }),
  });
  if (!novo.ok) { console.error('rc-comprar-criar: banco', await novo.text()); return resposta({ erro: 'banco' }, 500); }
  const [compra] = await novo.json();
  const ref = `rc_${compra.id}`;
  const volta = (status: string) => `${SITE}/?rc=${status}`;
  const cancelar = () => rest(`site_rc_compras?id=eq.${compra.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelado', atualizado: new Date().toISOString() }) });
  const rotulo = rcQtd.toLocaleString('en-US');

  if (provedor === 'mercadopago') {
    const r = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env('MP_ACCESS_TOKEN')}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': compra.id },
      body: JSON.stringify({
        items: [{ id: `rc-${rcQtd}`, title: `${rcQtd.toLocaleString('pt-BR')} Rift Coins`, description: 'Rift Coins do Rift Arcade', quantity: 1, currency_id: 'BRL', unit_price: valor }],
        external_reference: ref,
        back_urls: { success: volta('aprovado'), pending: volta('pendente'), failure: volta('falhou') },
        auto_return: 'approved',
        notification_url: `${SUPABASE_URL}/functions/v1/apoio-webhook`,
        statement_descriptor: 'RIFTARCADE',
      }),
    });
    if (!r.ok) { console.error('rc-comprar-criar: mercadopago', await r.text()); await cancelar(); return resposta({ erro: 'mercadopago' }, 502); }
    const p = await r.json();
    await rest(`site_rc_compras?id=eq.${compra.id}`, { method: 'PATCH', body: JSON.stringify({ ext_id: p.id }) });
    return resposta({ url: p.init_point });
  }

  const f = new URLSearchParams({
    mode: 'payment',
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': moeda.toLowerCase(),
    'line_items[0][price_data][unit_amount]': String(Math.round(valor * 100)),
    'line_items[0][price_data][product_data][name]': `${rotulo} Rift Coins`,
    'line_items[0][price_data][product_data][description]': 'Rift Coins for Rift Arcade',
    client_reference_id: ref,
    'metadata[rc_compra]': compra.id,
    'payment_intent_data[metadata][rc_compra]': compra.id,
    success_url: volta('aprovado'),
    cancel_url: volta('falhou'),
  });
  const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('STRIPE_SECRET_KEY')}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': compra.id },
    body: f,
  });
  if (!r.ok) { console.error('rc-comprar-criar: stripe', await r.text()); await cancelar(); return resposta({ erro: 'stripe' }, 502); }
  const s = await r.json();
  await rest(`site_rc_compras?id=eq.${compra.id}`, { method: 'PATCH', body: JSON.stringify({ ext_id: s.id }) });
  return resposta({ url: s.url });
});
