import '@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase } from '@supabase/server';
import Stripe from 'https://esm.sh/stripe@14?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
});

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

export default {
  fetch: withSupabase({ auth: 'none' }, async (req, ctx) => {
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return Response.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 },
      );
    }

    // Must read the RAW body text for signature verification —
    // req.json() would parse/re-serialize and break the signature check
    const rawBody = await req.text();

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        rawBody,
        signature,
        webhookSecret,
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return Response.json({ error: 'Invalid signature' }, { status: 400 });
    }

    try {
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;

          // TEMP DEBUG — remove after checking
          console.log('=== Webhook event:', event.type, '===');
          console.log('subscription.status:', subscription.status);
          console.log(
            'subscription.current_period_start:',
            subscription.current_period_start,
          );
          console.log(
            'subscription.current_period_end:',
            subscription.current_period_end,
          );
          console.log(
            'subscription.items.data:',
            JSON.stringify(subscription.items?.data, null, 2),
          );
          console.log(
            'subscription.cancel_at_period_end:',
            subscription.cancel_at_period_end,
          );
          console.log('subscription.metadata:', subscription.metadata);
          // END TEMP DEBUG

          const userId = subscription.metadata?.supabase_user_id;
          if (!userId) {
            console.error(
              'Subscription has no supabase_user_id metadata:',
              subscription.id,
            );
            break;
          }

          const tier =
            (subscription.metadata?.tier as
              | 'standard'
              | 'executive'
              | undefined) ?? 'executive';

          const firstItem = subscription.items?.data?.[0];
          const currentPeriodStart = firstItem?.current_period_start
            ? new Date(firstItem.current_period_start * 1000).toISOString()
            : null;
          const currentPeriodEnd = firstItem?.current_period_end
            ? new Date(firstItem.current_period_end * 1000).toISOString()
            : null;
          const trialEnd = subscription.trial_end
            ? new Date(subscription.trial_end * 1000).toISOString()
            : null;

          // event.type === "customer.subscription.deleted" means Stripe
          // fully removed it (e.g. after cancel_at_period_end finally
          // hit, or an immediate cancellation elsewhere). Map that to
          // your 'canceled' status explicitly rather than trusting
          // subscription.status alone, since Stripe's deleted-object
          // status can vary.
          const status =
            event.type === 'customer.subscription.deleted'
              ? 'canceled'
              : subscription.status;

          const { error: upsertError } = await ctx.supabaseAdmin
            .from('subscriptions')
            .upsert(
              {
                user_id: userId,
                provider: 'stripe',
                stripe_subscription_id: subscription.id,
                price_id: subscription.items.data[0]?.price?.id ?? null,
                tier,
                status,
                current_period_start: currentPeriodStart,
                current_period_end: currentPeriodEnd,
                cancel_at_period_end:
                  subscription.cancel_at_period_end ?? false,
                trial_end: trialEnd,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'stripe_subscription_id' },
            );

          if (upsertError) {
            console.error(
              'Failed to upsert subscription from webhook:',
              upsertError,
            );
            return Response.json(
              { error: 'Database write failed' },
              { status: 500 },
            );
          }
          break;
        }

        case 'invoice.payment_failed': {
          // A renewal charge failed (e.g. card declined at end of
          // trial or monthly cycle). Stripe will retry per your
          // dashboard's retry settings; subscription.updated will
          // fire separately once status actually changes (e.g. to
          // 'past_due'). We don't need to do anything extra here
          // unless you want to notify the user — logging for now.
          const invoice = event.data.object as Stripe.Invoice;
          console.log(
            'Payment failed for invoice:',
            invoice.id,
            'customer:',
            invoice.customer,
          );
          break;
        }

        default:
          // Unhandled event types are fine to ignore — Stripe sends
          // many event types we don't need to act on.
          break;
      }

      return Response.json({ received: true });
    } catch (error) {
      console.error('Webhook handler error:', error);
      return Response.json({ error: error.message }, { status: 500 });
    }
  }),
};
