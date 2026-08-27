import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});
const db = createClient(Deno.env.get('PROJECT_URL')!, Deno.env.get('SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

function makeCode(): string {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const b = crypto.getRandomValues(new Uint8Array(8));
  let s = '';
  for (const n of b) s += abc[n % abc.length];
  return 'SS-' + s;
}

async function setMemberBillingForPayment(payment: any, billing_status: 'active' | 'past_due' | 'canceled') {
  if (!payment?.invite_id) return;
  await db.from('profiles').update({ billing_status }).eq('invite_id', payment.invite_id).eq('role', 'member');
}

async function findPaymentBySubscription(subscription: string | null) {
  if (!subscription) return null;
  const { data } = await db.from('payments').select('*').eq('stripe_subscription', subscription).maybeSingle();
  return data;
}

async function handleCheckout(s: Stripe.Checkout.Session) {
  const email = s.customer_details?.email ?? s.customer_email ?? null;
  const subscription = typeof s.subscription === 'string' ? s.subscription : null;
  const { data: seen } = await db.from('payments').select('id,invite_id').eq('stripe_session_id', s.id).maybeSingle();
  if (seen?.invite_id) return;

  let code = makeCode();
  let invite: any = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const r = await db.from('invites').insert({
      code,
      label: `Paid — ${email ?? 'unknown'}`,
      email,
      max_uses: 1,
      expires_at: new Date(Date.now() + 30 * 864e5).toISOString(),
    }).select().single();
    if (!r.error) { invite = r.data; break; }
    code = makeCode();
  }
  if (!invite) throw new Error('could not create invite');

  const { data: pay, error: payErr } = await db.from('payments').upsert({
    stripe_session_id: s.id,
    stripe_customer: typeof s.customer === 'string' ? s.customer : null,
    stripe_subscription: subscription,
    email,
    amount_cents: s.amount_total,
    currency: s.currency ?? 'usd',
    status: 'paid',
    invite_id: invite.id,
    raw: { mode: s.mode, payment_status: s.payment_status },
    updated_at: new Date().toISOString(),
  }, { onConflict: 'stripe_session_id' }).select().single();
  if (payErr) throw payErr;
  if (pay) await db.from('invites').update({ payment_id: pay.id }).eq('id', invite.id);

  const resend = Deno.env.get('RESEND_API_KEY');
  const site = (Deno.env.get('SITE_URL') ?? '').replace(/\/$/, '');
  if (resend && email && site) {
    const link = `${site}/signup.html?invite=${encodeURIComponent(invite.code)}`;
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resend}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Seek & Scale <ryan@seekandscale.com>',
        to: [email],
        subject: "You're in — here's your invite",
        html: `<p>Thanks for joining Seek &amp; Scale.</p><p>Your invite code is <b>${invite.code}</b></p><p><a href="${link}">Set up your account</a></p><p>The code works once and expires in 30 days.</p>`,
      }),
    }).catch(() => {});
  }
}

Deno.serve(async (req) => {
  const sig = req.headers.get('stripe-signature');
  if (!sig) return new Response('no signature', { status: 400 });
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, Deno.env.get('STRIPE_WEBHOOK_SECRET')!, undefined, Stripe.createSubtleCryptoProvider());
  } catch (err) {
    return new Response(`bad signature: ${(err as Error).message}`, { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      await handleCheckout(event.data.object as Stripe.Checkout.Session);
    } else if (event.type === 'invoice.payment_failed' || event.type === 'invoice.paid') {
      const invoice: any = event.data.object;
      const subscription = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id ?? null;
      const payment = await findPaymentBySubscription(subscription);
      if (payment) {
        const good = event.type === 'invoice.paid';
        await db.from('payments').update({ status: good ? 'paid' : 'past_due', updated_at: new Date().toISOString() }).eq('id', payment.id);
        await setMemberBillingForPayment(payment, good ? 'active' : 'past_due');
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const sub: any = event.data.object;
      const payment = await findPaymentBySubscription(sub.id ?? null);
      if (payment) {
        await db.from('payments').update({ status: 'canceled', updated_at: new Date().toISOString() }).eq('id', payment.id);
        await setMemberBillingForPayment(payment, 'canceled');
      }
    }
    return new Response('ok', { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response('server error', { status: 500 });
  }
});
