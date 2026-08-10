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
      const trialDays = Number(setupIntent.metadata?.trial_days ?? 7);

      if (!priceId) {
        return Response.json(
          { error: 'Missing price_id on SetupIntent' },
          { status: 400 },
        );
      }

      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });

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

      const existingSubs = await stripe.subscriptions.list({
        customer: customerId,
        status: 'incomplete',
      });

      for (const sub of existingSubs.data) {
        await stripe.subscriptions.cancel(sub.id);
      }

      // ✅ Added: payment_behavior + expand, so we can see if 3DS is needed
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        trial_period_days: trialDays,
        default_payment_method: paymentMethodId,
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          supabase_user_id: user.id,
          tier,
        },
      });

      const currentPeriodStart = subscription.current_period_start
        ? new Date(subscription.current_period_start * 1000).toISOString()
        : new Date().toISOString();
      const currentPeriodEnd = subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null;
      const trialEnd = subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null;

      const { error: upsertError } = await ctx.supabaseAdmin
        .from('subscriptions')
        .upsert(
          {
            user_id: user.id,
            provider: 'stripe',
            stripe_subscription_id: subscription.id,
            price_id: priceId,
            tier,
            status: subscription.status,
            current_period_start: currentPeriodStart,
            current_period_end: currentPeriodEnd,
            cancel_at_period_end: subscription.cancel_at_period_end ?? false,
            trial_end: trialEnd,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'stripe_subscription_id' },
        );

      if (upsertError) {
        console.error('Failed to write subscriptions row:', upsertError);
      }

      const { error: markTrialUsedError } = await ctx.supabaseAdmin
        .from('profiles')
        .update({ has_used_trial: true, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (markTrialUsedError) {
        console.error('Failed to mark trial as used:', markTrialUsedError);
      }

      // ✅ Added: pull the PaymentIntent out (only present if a charge was actually attempted —
      // e.g. no trial days left, so payment is due immediately)
      const invoice = subscription.latest_invoice as Stripe.Invoice;
      let paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;

      if (paymentIntent && paymentIntent.status === 'requires_confirmation') {
        try {
          paymentIntent = await stripe.paymentIntents.confirm(
            paymentIntent.id,
            {
              payment_method: paymentMethodId,
            },
          );
        } catch (confirmError: any) {
          if (confirmError.payment_intent) {
            paymentIntent = confirmError.payment_intent;
          } else {
            console.error('PaymentIntent confirm failed:', confirmError);
            throw confirmError;
          }
        }
      }

      return Response.json({
        subscriptionId: subscription.id,
        status: subscription.status,
        paymentIntentStatus: paymentIntent?.status ?? null,
        paymentIntentClientSecret: paymentIntent?.client_secret ?? null,
      });
    } catch (error) {
      console.error(error);
      return Response.json({ error: error.message }, { status: 500 });
    }
  }),
};
