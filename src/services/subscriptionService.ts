import { supabase } from './supabase';
import { AuthService } from './authService';
import { Subscription } from '../types/Subscription';
import { mapSubscriptionRowToSubscription } from '../mappers/subscriptionMapper';
import { Platform } from 'react-native';
import { extractEdgeFunctionErrorMessage } from '../utils/edgeFunctionError';

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
          error: await extractEdgeFunctionErrorMessage(
            error,
            'Unable to create Stripe customer.',
          ),
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

  static async createTrialSetup(tier: 'standard' | 'executive'): Promise<{
    setupIntentClientSecret: string | null;
    ephemeralKeySecret: string | null;
    customerId: string | null;
    error: string | null;
  }> {
    try {
      const { data, error } = await supabase.functions.invoke(
        'create-trial-setup',
        {
          body: { tier, platform: Platform.OS },
        },
      );

      if (error) {
        return {
          setupIntentClientSecret: null,
          ephemeralKeySecret: null,
          customerId: null,
          error: await extractEdgeFunctionErrorMessage(
            error,
            'Unable to start subscription setup.',
          ),
        };
      }

      return {
        setupIntentClientSecret: data.setupIntentClientSecret,
        ephemeralKeySecret: data.ephemeralKeySecret,
        customerId: data.customerId,
        error: null,
      };
    } catch (err: any) {
      return {
        setupIntentClientSecret: null,
        ephemeralKeySecret: null,
        customerId: null,
        error: err.message ?? 'Unable to start subscription setup.',
      };
    }
  }

  static async confirmTrialSubscription(setupIntentId: string): Promise<{
    success: boolean;
    error: string | null;
    status?: string;
    paymentIntentStatus?: string | null;
    paymentIntentClientSecret?: string | null;
  }> {
    try {
      const { data, error } = await supabase.functions.invoke(
        'confirm-trial-subscription',
        {
          body: { setupIntentId },
        },
      );

      if (error) {
        return {
          success: false,
          error: await extractEdgeFunctionErrorMessage(
            error,
            'Unable to confirm subscription.',
          ),
        };
      }

      return {
        success: true,
        error: null,
        status: data.status,
        paymentIntentStatus: data.paymentIntentStatus,
        paymentIntentClientSecret: data.paymentIntentClientSecret,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message ?? 'Unable to confirm subscription.',
      };
    }
  }

  // SubscriptionService
  static async getTrialEligibility(): Promise<{
    isEligible: boolean;
    error: string | null;
  }> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return { isEligible: false, error: 'Not authenticated.' };
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('has_used_trial')
        .eq('id', user.id)
        .single();

      if (error) {
        return { isEligible: false, error: error.message };
      }

      return { isEligible: !data.has_used_trial, error: null };
    } catch (err: any) {
      return {
        isEligible: false,
        error: err.message ?? 'Unable to check trial eligibility.',
      };
    }
  }

  /**
   * Cancel subscription
   *
   * TODO:
   * Call cancel-subscription Edge Function
   */
  // SubscriptionService
  static async cancelSubscription(): Promise<{
    success: boolean;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: string | null;
    error: string | null;
  }> {
    try {
      const { data, error } = await supabase.functions.invoke(
        'cancel-subscription',
      );

      if (error) {
        return {
          success: false,
          cancelAtPeriodEnd: false,
          currentPeriodEnd: null,
          error: await extractEdgeFunctionErrorMessage(
            error,
            'Unable to cancel subscription.',
          ),
        };
      }

      return {
        success: true,
        cancelAtPeriodEnd: data.cancelAtPeriodEnd,
        currentPeriodEnd: data.currentPeriodEnd,
        error: null,
      };
    } catch (err: any) {
      return {
        success: false,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
        error: err.message ?? 'Unable to cancel subscription.',
      };
    }
  }

  static async syncSubscriptionStatus(): Promise<{
    synced: boolean;
    changed: boolean;
    status: string | null;
    error: string | null;
  }> {
    try {
      const { data, error } = await supabase.functions.invoke(
        'sync-subscription-status',
      );

      if (error) {
        return {
          synced: false,
          changed: false,
          status: null,
          error: await extractEdgeFunctionErrorMessage(
            error,
            'Unable to sync subscription.',
          ),
        };
      }

      return {
        synced: data.synced,
        changed: data.changed ?? false,
        status: data.status ?? null,
        error: null,
      };
    } catch (err: any) {
      return {
        synced: false,
        changed: false,
        status: null,
        error: err.message,
      };
    }
  }
}
