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

      const { data: profile, error: profileError } = await ctx.supabase
        .from('profiles')
        .select('stripe_customer_id')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      if (!profile.stripe_customer_id) {
        return Response.json({ synced: false, reason: 'no_customer' });
      }

      // Fetch ALL subscriptions for this customer, not just the latest —
      // a customer can legitimately have multiple over time (cancelled,
      // resubscribed, etc.), and every one needs to reflect Stripe's
      // real current status, not just the most recent.
      const subscriptions = await stripe.subscriptions.list({
        customer: profile.stripe_customer_id,
        limit: 100,
        status: 'all',
      });

      if (subscriptions.data.length === 0) {
        return Response.json({
          synced: false,
          reason: 'no_subscription_in_stripe',
        });
      }

      let anyChanged = false;
      let latestStatus: string | null = null;

      for (const stripeSubscription of subscriptions.data) {
        const { data: localRow, error: localRowError } = await ctx.supabaseAdmin
          .from('subscriptions')
          .select('id, status, cancel_at_period_end, created_at')
          .eq('stripe_subscription_id', stripeSubscription.id)
          .maybeSingle();

        if (localRowError) throw localRowError;

        const firstItem = stripeSubscription.items?.data?.[0];
        const currentPeriodStart = firstItem?.current_period_start
          ? new Date(firstItem.current_period_start * 1000).toISOString()
          : null;
        const currentPeriodEnd = firstItem?.current_period_end
          ? new Date(firstItem.current_period_end * 1000).toISOString()
          : null;
        const trialEnd = stripeSubscription.trial_end
          ? new Date(stripeSubscription.trial_end * 1000).toISOString()
          : null;

        const stripeStatus = stripeSubscription.status;
        const stripeCancelAtPeriodEnd =
          stripeSubscription.cancel_at_period_end ?? false;

        const isInSync =
          localRow &&
          localRow.status === stripeStatus &&
          localRow.cancel_at_period_end === stripeCancelAtPeriodEnd;

        if (!isInSync) {
          const tier =
            (stripeSubscription.metadata?.tier as
              | 'standard'
              | 'executive'
              | undefined) ?? 'executive';

          const { error: upsertError } = await ctx.supabaseAdmin
            .from('subscriptions')
            .upsert(
              {
                user_id: user.id,
                provider: 'stripe',
                stripe_subscription_id: stripeSubscription.id,
                price_id: firstItem?.price?.id ?? null,
                tier,
                status: stripeStatus,
                current_period_start: currentPeriodStart,
                current_period_end: currentPeriodEnd,
                cancel_at_period_end: stripeCancelAtPeriodEnd,
                trial_end: trialEnd,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'stripe_subscription_id' },
            );

          if (upsertError) throw upsertError;

          anyChanged = true;
          console.log(
            `Reconciled ${stripeSubscription.id}: local was "${
              localRow?.status ?? 'missing'
            }", Stripe says "${stripeStatus}"`,
          );
        }

        // Stripe's list() returns newest first by default — first
        // iteration is the current/latest subscription's status
        if (latestStatus === null) {
          latestStatus = stripeStatus;
        }
      }

      return Response.json({
        synced: true,
        changed: anyChanged,
        status: latestStatus,
      });
    } catch (error) {
      console.error(error);
      return Response.json({ error: error.message }, { status: 500 });
    }
  }),
};
