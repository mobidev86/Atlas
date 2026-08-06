import '@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase } from '@supabase/server';
import Stripe from 'https://esm.sh/stripe@14?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
});

const TRIAL_DAYS = 7;

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
      const setupIntentId = body.setupIntentId as string | undefined;

      if (!setupIntentId) {
        return Response.json(
          { error: 'setupIntentId is required' },
          { status: 400 },
        );
      }

      const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);

      if (setupIntent.status !== 'succeeded') {
        return Response.json(
          {
            error: `SetupIntent not completed (status: ${setupIntent.status})`,
          },
          { status: 400 },
        );
      }

      // Safety check: make sure this SetupIntent actually belongs to
      // this user, not someone replaying another user's ID
      if (setupIntent.metadata?.supabase_user_id !== user.id) {
        return Response.json(
          { error: 'SetupIntent mismatch' },
          { status: 403 },
        );
      }

      const tier = (setupIntent.metadata?.tier ?? 'executive') as
        | 'standard'
        | 'executive';
      const priceId = setupIntent.metadata?.price_id;
      const customerId = setupIntent.customer as string;
      const paymentMethodId = setupIntent.payment_method as string;

      if (!priceId) {
        return Response.json(
          { error: 'Missing price_id on SetupIntent' },
          { status: 400 },
        );
      }

      // Set the newly saved card as this customer's default payment method
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });

      // Guard against double-submission creating two subscriptions
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

      // Create the actual subscription with a 7-day trial.
      // Nothing is charged now — Stripe will attempt the first charge
      // automatically when the trial ends. Your webhook function is
      // what keeps the `subscriptions` table in sync with this.
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        trial_period_days: TRIAL_DAYS,
        default_payment_method: paymentMethodId,
        metadata: {
          supabase_user_id: user.id,
          tier,
        },
      });

      return Response.json({
        subscriptionId: subscription.id,
        status: subscription.status,
      });
    } catch (error) {
      console.error(error);
      return Response.json({ error: error.message }, { status: 500 });
    }
  }),
};
