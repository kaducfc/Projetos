// Edge Function "apoio-criar": a conta logada escolhe um valor e recebe o
// link de pagamento do Mercado Pago (Checkout Pro: Pix, cartão ou boleto).
//
// Segredos (Supabase → Edge Functions → Secrets):
//   MP_ACCESS_TOKEN  Access Token de produção do Mercado Pago (APP_USR-...)
//   SITE_URL         https://riftarcade.com.br  (opcional)
// SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY já vêm prontos.
// Na criação da função, DESLIGUE "Verify JWT": a conta é conferida aqui.

const MINIMO = 5;
const MAXIMO = 99999999; // sem limite para cima (só o teto do banco, numeric(10, 2))

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
  const MP = env('MP_ACCESS_TOKEN');
  const SITE = env('SITE_URL') || 'https://riftarcade.com.br';
  if (!MP) return resposta({ erro: 'mp_nao_configurado' }, 503);

  // Quem está pedindo (token da sessão do site).
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const quem = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
  if (!quem.ok) return resposta({ erro: 'nao_logado' }, 401);
  const user = await quem.json();

  let valor;
  try {
    valor = Math.round(Number((await req.json()).valor) * 100) / 100;
  } catch {
    return resposta({ erro: 'valor_invalido' }, 400);
  }
  if (!Number.isFinite(valor) || valor < MINIMO || valor > MAXIMO) return resposta({ erro: 'valor_invalido' }, 400);

  const rest = (caminho, init = {}) => fetch(`${SUPABASE_URL}/rest/v1/${caminho}`, {
    ...init,
    headers: { apikey: SERVICO, Authorization: `Bearer ${SERVICO}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers || {}) },
  });

  // Contra robô: no máximo 10 pagamentos abertos por conta a cada hora.
  const umaHora = new Date(Date.now() - 3600_000).toISOString();
  const recentes = await rest(`site_apoios?select=id&user_id=eq.${user.id}&criado=gte.${umaHora}&limit=10`);
  if (recentes.ok && (await recentes.json()).length >= 10) return resposta({ erro: 'muitos_pedidos' }, 429);

  // 1) Registra a doação pendente.
  const novo = await rest('site_apoios', { method: 'POST', body: JSON.stringify({ user_id: user.id, valor }) });
  if (!novo.ok) {
    console.error('apoio-criar: banco', await novo.text()); // detalhe só no log do Supabase
    return resposta({ erro: 'banco' }, 500);
  }
  const [apoio] = await novo.json();

  // 2) Cria o pagamento no Mercado Pago.
  const pref = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: { Authorization: `Bearer ${MP}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': apoio.id },
    body: JSON.stringify({
      items: [{ id: 'apoio', title: 'Apoio ao Rift Arcade', description: 'Apoio voluntário ao site (cosméticos, sem vantagem nos jogos)', quantity: 1, currency_id: 'BRL', unit_price: valor }],
      external_reference: apoio.id,
      // Sem e-mail do pagador: se for o mesmo e-mail da conta que recebe, o
      // Mercado Pago entende que a pessoa está pagando para si mesma e recusa.
      back_urls: {
        success: `${SITE}/apoiar/?status=aprovado&apoio=${apoio.id}`,
        pending: `${SITE}/apoiar/?status=pendente&apoio=${apoio.id}`,
        failure: `${SITE}/apoiar/?status=falhou&apoio=${apoio.id}`,
      },
      auto_return: 'approved',
      notification_url: `${SUPABASE_URL}/functions/v1/apoio-webhook`,
      statement_descriptor: 'RIFTARCADE',
    }),
  });
  if (!pref.ok) {
    await rest(`site_apoios?id=eq.${apoio.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelado', atualizado: new Date().toISOString() }) });
    const texto = await pref.text();
    console.error('apoio-criar: mercadopago', texto); // detalhe só no log do Supabase
    return resposta({ erro: 'mercadopago', token_invalido: /invalid.*token|unauthorized|401/i.test(texto) }, 502);
  }
  const p = await pref.json();
  await rest(`site_apoios?id=eq.${apoio.id}`, { method: 'PATCH', body: JSON.stringify({ mp_preference_id: p.id }) });
  return resposta({ url: p.init_point, apoio: apoio.id });
});
