export interface SubscriptionRow {
  id: string;
  user_id: string;

  provider: 'stripe' | 'apple';

  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  apple_transaction_id: string | null;

  price_id: string | null;

  tier: 'standard' | 'executive';

  status:
    | 'none'
    | 'trialing'
    | 'active'
    | 'past_due'
    | 'canceled'
    | 'expired'
    | 'paused';

  current_period_start: string | null;
  current_period_end: string | null;

  cancel_at_period_end: boolean | null;

  trial_end: string | null;

  created_at: string;
  updated_at: string;
}