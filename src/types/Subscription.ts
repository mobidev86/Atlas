export type SubscriptionProvider =
  | 'stripe'
  | 'apple';

export type SubscriptionStatus =
  | 'none'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'expired'
  | 'paused';

export type SubscriptionTier =
  | 'standard'
  | 'executive';

export interface Subscription {
  id: string;
  userId: string;

  provider: SubscriptionProvider;

  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  appleTransactionId?: string;

  priceId?: string;

  tier: SubscriptionTier;

  status: SubscriptionStatus;

  currentPeriodStart?: string;
  currentPeriodEnd?: string;

  cancelAtPeriodEnd: boolean;

  trialEnd?: string;

  createdAt: string;
  updatedAt: string;
}