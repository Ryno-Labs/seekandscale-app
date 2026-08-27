import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const db = createClient(
  Deno.env.get('PROJECT_URL')!,
  Deno.env.get('SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

function corsHeaders() {
  const site = Deno.env.get('SITE_URL') || '';
  let origin = '*';
  try { origin = new URL(site).origin; } catch (_) {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'apikey, authorization, content-type',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json',
  };
}

Deno.serve(async (req) => {
  const headers = corsHeaders();
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'GET') return new Response(JSON.stringify({ error: 'method' }), { status: 405, headers });

  const sid = new URL(req.url).searchParams.get('session_id') ?? '';
  if (!sid.startsWith('cs_')) return new Response(JSON.stringify({ error: 'bad session' }), { status: 400, headers });

  const { data, error } = await db
    .from('payments')
    .select('status, invites(code, used_count, max_uses, revoked, expires_at)')
    .eq('stripe_session_id', sid)
    .maybeSingle();

  if (error) return new Response(JSON.stringify({ error: 'lookup failed' }), { status: 500, headers });
  const inv: any = data?.invites;
  if (!inv) return new Response(JSON.stringify({ pending: true }), { status: 200, headers });
  if (inv.revoked || inv.used_count >= inv.max_uses || (inv.expires_at && new Date(inv.expires_at) < new Date())) {
    return new Response(JSON.stringify({ pending: true }), { status: 200, headers });
  }
  return new Response(JSON.stringify({ code: inv.code }), { status: 200, headers });
});
