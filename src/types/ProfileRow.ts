import { TravelPreferences, DiningPreferences } from './UserProfile';

export interface ProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  stripe_customer_id: string | null;
  subscription_status: 'active' | 'trialing' | 'canceled' | 'none' | null;
  subscription_tier: 'executive' | 'standard' | null;
  auto_book_enabled: boolean | null;
  zero_retention_enabled: boolean | null;
  travel_preferences: TravelPreferences | null;
  dining_preferences: DiningPreferences | null;
  nylas_grant_id: string | null;
  nylas_account_status: 'connected' | 'syncing' | 'disconnected' | null;
  last_email_synced_at: string | null;
  created_at: string;
  updated_at: string;
}
