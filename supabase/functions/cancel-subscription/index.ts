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

      const { data: row, error: rowError } = await ctx.supabaseAdmin
        .from('subscriptions')
        .select('id, stripe_subscription_id, status')
        .eq('user_id', user.id)
        .in('status', ['active', 'trialing'])
        .maybeSingle();

      if (rowError) throw rowError;

      if (!row || !row.stripe_subscription_id) {
        return Response.json(
          { error: 'No active subscription found.' },
          { status: 404 },
        );
      }

      // Cancel at period end — user keeps access until the current
      // period/trial actually runs out, rather than losing it instantly.
      const subscription = await stripe.subscriptions.update(
        row.stripe_subscription_id,
        { cancel_at_period_end: true },
      );

      // Optimistic local update so the UI reflects this immediately.
      // The webhook (customer.subscription.updated) will also fire and
      // write the same thing shortly after — this just avoids the user
      // seeing stale "still active, not cancelling" state in the meantime.
      const { error: updateError } = await ctx.supabaseAdmin
        .from('subscriptions')
        .update({
          cancel_at_period_end: true,
          status: subscription.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);

      if (updateError) {
        console.error(
          'Failed to optimistically update subscription row:',
          updateError,
        );
      }

      return Response.json({
        success: true,
        cancelAtPeriodEnd: true,
        currentPeriodEnd: subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null,
      });
    } catch (error) {
      console.error(error);
      return Response.json({ error: error.message }, { status: 500 });
    }
  }),
};
