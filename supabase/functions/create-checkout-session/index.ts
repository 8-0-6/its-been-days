// supabase/functions/create-checkout-session/index.ts
// Creates a Stripe Checkout session and returns the URL.
//
// Deploy:  supabase functions deploy create-checkout-session
// Secrets: supabase secrets set STRIPE_SECRET_KEY=sk_... STRIPE_PRICE_ID=price_...
//
// STRIPE_PRICE_ID: create a Product + recurring Price in the Stripe Dashboard
//   Dashboard → Products → Add product → $5/month recurring → copy the price ID

import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const PRICE_ID = Deno.env.get('STRIPE_PRICE_ID')!;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return cors(new Response(null, { status: 204 }));
  }
  if (req.method !== 'POST') {
    return cors(new Response('Method not allowed', { status: 405 }));
  }

  let body: { email?: string; success_url: string; cancel_url: string };
  try {
    body = await req.json();
  } catch {
    return cors(new Response('Invalid JSON', { status: 400 }));
  }

  try {
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      success_url: body.success_url,
      cancel_url: body.cancel_url,
      // Pre-fill email if the user is already signed in
      ...(body.email ? { customer_email: body.email } : {}),
      // Allow promotion codes
      allow_promotion_codes: true,
    };

    const session = await stripe.checkout.sessions.create(sessionParams);
    return cors(
      new Response(JSON.stringify({ url: session.url }), {
        headers: { 'Content-Type': 'application/json' },
      })
    );
  } catch (err) {
    console.error('Error creating checkout session:', err);
    return cors(new Response('Failed to create checkout session', { status: 500 }));
  }
});

function cors(res: Response): Response {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Headers', 'authorization, apikey, content-type');
  return res;
}
