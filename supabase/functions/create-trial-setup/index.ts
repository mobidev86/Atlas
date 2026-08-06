import '@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase } from '@supabase/server';
import Stripe from 'https://esm.sh/stripe@14?target=deno';

// in create-trial-setup, near the top of the handler
const body = await req.json().catch(() => ({}));
const platform = body.platform as string | undefined;

if (platform === 'ios') {
  return Response.json(
    { error: "Stripe billing isn't available on iOS. Use in-app purchase." },
    { status: 400 },
  );
}

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
});

// Set these in your Supabase project's Edge Function secrets
const PRICE_IDS: Record<string, string> = {
  standard: Deno.env.get('STRIPE_PRICE_STANDARD')!,
  executive: Deno.env.get('STRIPE_PRICE_EXECUTIVE')!,
};

export default {
  fetch: withSupabase({ auth: ['publishable'] }, async (req, ctx) => {
    try {
      const {
        data: { user },
        error: userError,
      } = await ctx.supabase.auth.getUser();

      if (userError || !user) {
        return Response.json(
          { error: 'User not authenticated' },
          { status: 401 },
        );
      }

      const body = await req.json().catch(() => ({}));
      const tier: 'standard' | 'executive' =
        body.tier === 'standard' ? 'standard' : 'executive';
      const priceId = PRICE_IDS[tier];

      if (!priceId) {
        return Response.json(
          { error: `Price not configured for tier: ${tier}` },
          { status: 400 },
        );
      }

      const { data: profile, error: profileError } = await ctx.supabase
        .from('profiles')
        .select('stripe_customer_id')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      if (!profile.stripe_customer_id) {
        return Response.json(
          {
            error: 'No Stripe customer yet. Call create-stripe-customer first.',
          },
          { status: 400 },
        );
      }

      const customerId = profile.stripe_customer_id;

      // Block duplicate subscriptions
      const { data: existing } = await ctx.supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .in('status', ['active', 'trialing'])
        .maybeSingle();

      if (existing) {
        return Response.json(
          { error: 'You already have an active subscription.' },
          { status: 409 },
        );
      }

      // Lets PaymentSheet manage this customer's saved cards
      const ephemeralKey = await stripe.ephemeralKeys.create(
        { customer: customerId },
        { apiVersion: '2024-06-20' },
      );

      // SetupIntent: saves a card for future use, charges $0 now.
      // The actual subscription (with the 7-day trial) is created
      // separately in confirm-trial-subscription, once this succeeds.
      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
        usage: 'off_session',
        metadata: {
          supabase_user_id: user.id,
          tier,
          price_id: priceId,
        },
      });

      return Response.json({
        setupIntentClientSecret: setupIntent.client_secret,
        ephemeralKeySecret: ephemeralKey.secret,
        customerId,
        tier,
      });
    } catch (error) {
      console.error(error);
      return Response.json({ error: error.message }, { status: 500 });
    }
  }),
};
