// supabase/functions/create-portal-session/index.ts
// Creates a Stripe Customer Portal session for subscription management.
//
// Deploy: supabase functions deploy create-portal-session
//
// The portal lets subscribers update their payment method, view invoices,
// and cancel their subscription. No extra Stripe configuration needed —
// the portal is enabled by default in the Stripe Dashboard.

import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return cors(new Response(null, { status: 204 }));
  }
  if (req.method !== 'POST') {
    return cors(new Response('Method not allowed', { status: 405 }));
  }

  // Require auth — get the user from the JWT
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return cors(new Response('Unauthorized', { status: 401 }));
  }

  const { data: { user }, error: authErr } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  );
  if (authErr || !user) {
    return cors(new Response('Unauthorized', { status: 401 }));
  }

  // Fetch the user's Stripe customer ID
  const { data: row, error: dbErr } = await supabase
    .from('users')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single();

  if (dbErr || !row?.stripe_customer_id) {
    return cors(new Response('No subscription found', { status: 404 }));
  }

  let body: { return_url: string };
  try {
    body = await req.json();
  } catch {
    return cors(new Response('Invalid JSON', { status: 400 }));
  }

  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: row.stripe_customer_id,
      return_url: body.return_url,
    });

    return cors(
      new Response(JSON.stringify({ url: portal.url }), {
        headers: { 'Content-Type': 'application/json' },
      })
    );
  } catch (err) {
    console.error('Error creating portal session:', err);
    return cors(new Response('Failed to create portal session', { status: 500 }));
  }
});

function cors(res: Response): Response {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Headers', 'authorization, apikey, content-type');
  return res;
}
