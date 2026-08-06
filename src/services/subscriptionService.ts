import { supabase } from './supabase';
import { AuthService } from './authService';
import { Subscription } from '../types/Subscription';
import { mapSubscriptionRowToSubscription } from '../mappers/subscriptionMapper';

export class SubscriptionService {
  /**
   * Get current user subscription
   */
  static async getCurrentSubscription(): Promise<{
    subscription: Subscription | null;
    error: string | null;
  }> {
    try {
      const { user } = await AuthService.getCurrentUser();

      if (!user) {
        return {
          subscription: null,
          error: 'User not authenticated.',
        };
      }

      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['active', 'trialing'])
        .order('created_at', {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

      if (error) {
        return {
          subscription: null,
          error: error.message,
        };
      }

      return {
        subscription: data ? mapSubscriptionRowToSubscription(data) : null,
        error: null,
      };
    } catch (err: any) {
      return {
        subscription: null,
        error: err.message || 'Unable to fetch subscription.',
      };
    }
  }

  /**
   * Check if user has active subscription
   */
  static async checkSubscription(): Promise<boolean> {
    const { subscription } = await this.getCurrentSubscription();

    if (!subscription) {
      return false;
    }

    return (
      subscription.status === 'active' || subscription.status === 'trialing'
    );
  }

  /**
   * Create Stripe customer
   *
   * Calls:
   * supabase/functions/create-stripe-customer
   */
  static async createStripeCustomer(): Promise<{
    success: boolean;
    customerId: string | null;
    error: string | null;
  }> {
    try {
      const { data, error } = await supabase.functions.invoke(
        'create-stripe-customer',
      );

      if (error) {
        return {
          success: false,
          customerId: null,
          error: error.message,
        };
      }

      return {
        success: true,

        customerId: data.customerId,

        error: null,
      };
    } catch (err: any) {
      return {
        success: false,

        customerId: null,

        error: err.message || 'Unable to create Stripe customer',
      };
    }
  }

  /**
   * Start subscription flow
   *
   * Android:
   * Stripe Billing
   *
   * iOS:
   * Apple IAP (later)
   */
  static async subscribeUser(
    planTier: 'executive' | 'standard' = 'executive',
  ): Promise<{
    success: boolean;
    customerId: string | null;
    error: string | null;
  }> {
    try {
      const { user } = await AuthService.getCurrentUser();

      if (!user) {
        return {
          success: false,
          customerId: null,
          error: 'User not authenticated.',
        };
      }

      /**
       * Step 1:
       * Create Stripe customer
       *
       * Step 2:
       * Create subscription
       *
       * Step 3:
       * Open Payment Sheet
       *
       * Step 4:
       * Webhook updates subscriptions table
       */

      const customerResult = await this.createStripeCustomer();

      if (!customerResult.success) {
        return {
          success: false,
          customerId: null,
          error: customerResult.error,
        };
      }

      return {
        success: true,

        customerId: customerResult.customerId,

        error: null,
      };
    } catch (err: any) {
      return {
        success: false,

        customerId: null,

        error: err.message || 'Subscription failed.',
      };
    }
  }

  /**
   * Cancel subscription
   *
   * TODO:
   * Call cancel-subscription Edge Function
   */
  static async cancelSubscription(): Promise<{
    success: boolean;
    error: string | null;
  }> {
    try {
      const { user } = await AuthService.getCurrentUser();

      if (!user) {
        return {
          success: false,
          error: 'User not authenticated.',
        };
      }

      // Later:
      // supabase.functions.invoke(
      //   'cancel-subscription'
      // )

      return {
        success: true,
        error: null,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Failed to cancel subscription',
      };
    }
  }
}
