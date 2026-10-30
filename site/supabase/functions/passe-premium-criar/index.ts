// Edge Function "passe-premium-criar": compra do Passe Premium do Passe de Batalha.
//   { provedor: 'mercadopago', passe }  →  em reais (Pix, cartão ou boleto): R$ 15 no Halloween 2026, R$ 25 no Zaun e Piltover
//   { provedor: 'stripe', passe }       →  em dólar (cartão, Apple Pay, Google Pay): US$ 10 no Halloween 2026, US$ 15 no Zaun e Piltover
//   `passe` é opcional (sem ele, vale o Halloween 2026).
// O preço é decidido AQUI (o site só escolhe o provedor). Devolve { url } para onde a
// pessoa vai pagar; a confirmação chega pelos webhooks (apoio-webhook e apoio-intl-webhook),
// que chamam site_passe_confirmar_compra e ligam o premium.
//
// Segredos: MP_ACCESS_TOKEN (Mercado Pago), STRIPE_SECRET_KEY (Stripe), SITE_URL (opcional).
// Na criação da função, DESLIGUE "Verify JWT": a conta é conferida aqui.

const PASSES: Record<string, { titulo: string; brl: number; usd: number }> = {
  'halloween-2026': { titulo: 'Halloween 2026', brl: 15, usd: 10 },
  'zaun-piltover-2026': { titulo: 'Zaun e Piltover', brl: 25, usd: 15 },
};
const PROVEDORES = ['mercadopago', 'stripe'];

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

  let corpo: Record<string, unknown>;
  try { corpo = await req.json(); } catch { return resposta({ erro: 'pedido_invalido' }, 400); }
  const provedor = String(corpo.provedor || '');
  if (!PROVEDORES.includes(provedor)) return resposta({ erro: 'provedor' }, 400);
  const PASSE = String(corpo.passe || 'halloween-2026');
  const dadosPasse = PASSES[PASSE];
  if (!dadosPasse) return resposta({ erro: 'passe_indisponivel' }, 400);
  const preco = provedor === 'mercadopago' ? { moeda: 'BRL', valor: dadosPasse.brl } : { moeda: 'USD', valor: dadosPasse.usd };
  if (provedor === 'mercadopago' && !env('MP_ACCESS_TOKEN')) return resposta({ erro: 'mp_nao_configurado' }, 503);
  if (provedor === 'stripe' && !env('STRIPE_SECRET_KEY')) return resposta({ erro: 'stripe_nao_configurado' }, 503);

  // Quem está pedindo (token da sessão do site).
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const quem = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
  if (!quem.ok) return resposta({ erro: 'nao_logado' }, 401);
  const user = await quem.json();

  const rest = (caminho: string, init: RequestInit = {}) => fetch(`${SUPABASE_URL}/rest/v1/${caminho}`, {
    ...init,
    headers: { apikey: SERVICO, Authorization: `Bearer ${SERVICO}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers || {}) },
  });

  // O passe está disponível para esta conta e ela ainda não é premium?
  const pode = await rest('rpc/site_passe_pode_comprar', { method: 'POST', body: JSON.stringify({ uid: user.id, pid: PASSE }) });
  if (!pode.ok) { console.error('passe-premium-criar: pode_comprar', await pode.text()); return resposta({ erro: 'banco' }, 500); }
  const motivo = await pode.json();
  if (motivo !== 'ok') return resposta({ erro: motivo }, 409);

  // Contra robô: no máximo 10 compras abertas por conta a cada hora.
  const umaHora = new Date(Date.now() - 3600_000).toISOString();
  const recentes = await rest(`site_passe_compras?select=id&user_id=eq.${user.id}&criado=gte.${umaHora}&limit=10`);
  if (recentes.ok && (await recentes.json()).length >= 10) return resposta({ erro: 'muitos_pedidos' }, 429);

  // Valor em reais só para somar no painel (Stripe em dólar usa a cotação USD_BRL).
  const valorBrl = preco.moeda === 'BRL' ? preco.valor : Math.round(preco.valor * (Number(Deno.env.get('USD_BRL')) || 5.5) * 100) / 100;
  const novo = await rest('site_passe_compras', {
    method: 'POST',
    body: JSON.stringify({ user_id: user.id, passe: PASSE, provedor, moeda: preco.moeda, valor: preco.valor, valor_brl: valorBrl }),
  });
  if (!novo.ok) { console.error('passe-premium-criar: banco', await novo.text()); return resposta({ erro: 'banco' }, 500); }
  const [compra] = await novo.json();
  const ref = `passe_${compra.id}`;
  const volta = (status: string) => `${SITE}/passe/?compra=${status}`;
  const cancelar = () => rest(`site_passe_compras?id=eq.${compra.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelado', atualizado: new Date().toISOString() }) });

  if (provedor === 'mercadopago') {
    const r = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env('MP_ACCESS_TOKEN')}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': compra.id },
      body: JSON.stringify({
        items: [{ id: 'passe-premium', title: `Passe de Batalha Premium · ${dadosPasse.titulo}`, description: `Passe Premium do Rift Arcade (temporada ${dadosPasse.titulo})`, quantity: 1, currency_id: 'BRL', unit_price: preco.valor }],
        external_reference: ref,
        back_urls: { success: volta('aprovado'), pending: volta('pendente'), failure: volta('falhou') },
        auto_return: 'approved',
        notification_url: `${SUPABASE_URL}/functions/v1/apoio-webhook`,
        statement_descriptor: 'RIFTARCADE',
      }),
    });
    if (!r.ok) { console.error('passe-premium-criar: mercadopago', await r.text()); await cancelar(); return resposta({ erro: 'mercadopago' }, 502); }
    const p = await r.json();
    await rest(`site_passe_compras?id=eq.${compra.id}`, { method: 'PATCH', body: JSON.stringify({ ext_id: p.id }) });
    return resposta({ url: p.init_point });
  }

  const f = new URLSearchParams({
    mode: 'payment',
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(Math.round(preco.valor * 100)),
    'line_items[0][price_data][product_data][name]': 'Rift Arcade Battle Pass · Premium',
    'line_items[0][price_data][product_data][description]': `Premium Battle Pass for the ${dadosPasse.titulo} season`,
    client_reference_id: ref,
    'metadata[passe_compra]': compra.id,
    'payment_intent_data[metadata][passe_compra]': compra.id,
    success_url: volta('aprovado'),
    cancel_url: volta('falhou'),
  });
  const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('STRIPE_SECRET_KEY')}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': compra.id },
    body: f,
  });
  if (!r.ok) { console.error('passe-premium-criar: stripe', await r.text()); await cancelar(); return resposta({ erro: 'stripe' }, 502); }
  const s = await r.json();
  await rest(`site_passe_compras?id=eq.${compra.id}`, { method: 'PATCH', body: JSON.stringify({ ext_id: s.id }) });
  return resposta({ url: s.url });
});
