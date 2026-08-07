import '@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase } from '@supabase/server';
import Stripe from 'https://esm.sh/stripe@14?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
});

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
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
      const platform: 'android' | 'ios' =
        body.platform === 'ios' ? 'ios' : 'android';

      if (platform === 'ios') {
        return Response.json(
          {
            error:
              "Stripe billing isn't available on iOS. Use in-app purchase.",
          },
          { status: 400 },
        );
      }

      // Look up the active product config instead of reading env vars
      const { data: product, error: productError } = await ctx.supabase
        .from('subscription_products')
        .select('price_id, trial_days')
        .eq('platform', platform)
        .eq('tier', tier)
        .eq('is_active', true)
        .single();

      if (productError || !product?.price_id) {
        return Response.json(
          { error: `No active price configured for ${platform}/${tier}` },
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

      const { data: activeOrTrialing, error: subError } =
        await ctx.supabaseAdmin
          .from('subscriptions')
          .select('id')
          .eq('user_id', user.id)
          .in('status', ['active', 'trialing'])
          .maybeSingle();

      if (subError) throw subError;

      if (activeOrTrialing) {
        return Response.json(
          { error: 'You already have an active subscription.' },
          { status: 409 },
        );
      }

      const ephemeralKey = await stripe.ephemeralKeys.create(
        { customer: customerId },
        { apiVersion: '2024-06-20' },
      );

      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
        usage: 'off_session',
        metadata: {
          supabase_user_id: user.id,
          tier,
          price_id: product.price_id,
          trial_days: String(product.trial_days),
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
