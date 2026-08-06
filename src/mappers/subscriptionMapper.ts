import { SubscriptionRow } from '../types/SubscriptionRow';
import { Subscription } from '../types/Subscription';

export const mapSubscriptionRowToSubscription = (row: SubscriptionRow): Subscription => {
  return {
    id: row.id,
    userId: row.user_id,
    provider: row.provider,
    stripeCustomerId: row.stripe_customer_id ?? undefined,
    stripeSubscriptionId: row.stripe_subscription_id ?? undefined,
    appleTransactionId: row.apple_transaction_id ?? undefined,
    priceId: row.price_id ?? undefined,
    tier: row.tier,
    status: row.status,
    currentPeriodStart: row.current_period_start ?? undefined,
    currentPeriodEnd: row.current_period_end ?? undefined,
    cancelAtPeriodEnd: row.cancel_at_period_end ?? false,
    trialEnd: row.trial_end ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};