import { supabase } from './supabase';
import { AuthService } from './authService';

import { Subscription } from '../types/Subscription';
import { mapSubscriptionRowToSubscription } from '../mappers/subscriptionMapper';

import { Platform } from 'react-native';

import { extractEdgeFunctionErrorMessage } from '../utils/edgeFunctionError';

export class SubscriptionService {
  /**
   * -----------------------------------------
   * Get Current Subscription
   * -----------------------------------------
   *
   * IMPORTANT:
   *
   * When userId is supplied, this method performs
   * ONLY the subscriptions query.
   *
   * It does NOT:
   *
   * - restore the session
   * - call getSession()
   * - call getUser()
   * - fetch the profile
   *
   * This is critical during application startup.
   */
  static async getCurrentSubscription(userId?: string): Promise<{
    subscription: Subscription | null;
    error: string | null;
  }> {
    try {
      let resolvedUserId = userId;

      /**
       * Compatibility fallback.
       *
       * Existing callers that don't provide a userId
       * can still use this method.
       *
       * AuthContext ALWAYS provides userId.
       */
      if (!resolvedUserId) {
        const { user, error: authError } = await AuthService.getCurrentUser();

        if (authError) {
          return {
            subscription: null,
            error: authError,
          };
        }

        if (!user?.id) {
          return {
            subscription: null,
            error: 'User not authenticated.',
          };
        }

        resolvedUserId = user.id;
      }

      /**
       * ---------------------------------------
       * Subscription query
       * ---------------------------------------
       */
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', resolvedUserId)
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
    } catch (error: any) {
      return {
        subscription: null,
        error: error?.message || 'Unable to fetch subscription.',
      };
    }
  }

  /**
   * -----------------------------------------
   * Check Subscription
   * -----------------------------------------
   */
  static async checkSubscription(userId?: string): Promise<boolean> {
    const { subscription } = await this.getCurrentSubscription(userId);

    if (!subscription) {
      return false;
    }

    return (
      subscription.status === 'active' || subscription.status === 'trialing'
    );
  }

  /**
   * -----------------------------------------
   * Create Stripe Customer
   * -----------------------------------------
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
        customerId: data?.customerId ?? null,
        error: null,
      };
    } catch (error: any) {
      return {
        success: false,
        customerId: null,
        error: error?.message || 'Unable to create Stripe customer.',
      };
    }
  }

  /**
   * -----------------------------------------
   * Start Subscription Flow
   * -----------------------------------------
   */
  static async subscribeUser(
    planTier: 'executive' | 'standard' = 'executive',
  ): Promise<{
    success: boolean;
    customerId: string | null;
    error: string | null;
  }> {
    try {
      /**
       * This call is kept because subscription
       * creation requires an authenticated user.
       */
      const { user, error: authError } = await AuthService.getCurrentUser();

      if (authError) {
        return {
          success: false,
          customerId: null,
          error: authError,
        };
      }

      if (!user) {
        return {
          success: false,
          customerId: null,
          error: 'User not authenticated.',
        };
      }

      /**
       * Keep the existing argument available for
       * future subscription-tier handling.
       */
      void planTier;

      /**
       * Step 1:
       * Create Stripe customer
       */
      const customerResult = await this.createStripeCustomer();

      if (!customerResult.success) {
        return {
          success: false,
          customerId: null,
          error: customerResult.error,
        };
      }

      /**
       * The existing application currently only
       * creates the customer here.
       *
       * The remaining subscription/payment flow
       * can continue through the existing Stripe
       * implementation.
       */
      return {
        success: true,
        customerId: customerResult.customerId,
        error: null,
      };
    } catch (error: any) {
      return {
        success: false,
        customerId: null,
        error: error?.message || 'Subscription failed.',
      };
    }
  }

  /**
   * -----------------------------------------
   * Create Trial Setup
   * -----------------------------------------
   */
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
          body: {
            tier,
            platform: Platform.OS,
          },
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
        setupIntentClientSecret: data?.setupIntentClientSecret ?? null,

        ephemeralKeySecret: data?.ephemeralKeySecret ?? null,

        customerId: data?.customerId ?? null,

        error: null,
      };
    } catch (error: any) {
      return {
        setupIntentClientSecret: null,
        ephemeralKeySecret: null,
        customerId: null,
        error: error?.message || 'Unable to start subscription setup.',
      };
    }
  }

  /**
   * -----------------------------------------
   * Confirm Trial Subscription
   * -----------------------------------------
   */
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
          body: {
            setupIntentId,
          },
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
        status: data?.status,
        paymentIntentStatus: data?.paymentIntentStatus ?? null,
        paymentIntentClientSecret: data?.paymentIntentClientSecret ?? null,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Unable to confirm subscription.',
      };
    }
  }

  /**
   * -----------------------------------------
   * Trial Eligibility
   * -----------------------------------------
   */
  static async getTrialEligibility(): Promise<{
    isEligible: boolean;
    error: string | null;
  }> {
    try {
      /**
       * This method genuinely needs the current
       * authenticated Supabase user because it
       * doesn't receive a userId.
       *
       * Unlike the subscription startup flow,
       * this is an explicit eligibility check.
       */
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        return {
          isEligible: false,
          error: authError.message,
        };
      }

      if (!user) {
        return {
          isEligible: false,
          error: 'Not authenticated.',
        };
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('has_used_trial')
        .eq('id', user.id)
        .single();

      if (error) {
        return {
          isEligible: false,
          error: error.message,
        };
      }

      return {
        isEligible: !data.has_used_trial,
        error: null,
      };
    } catch (error: any) {
      return {
        isEligible: false,
        error: error?.message || 'Unable to check trial eligibility.',
      };
    }
  }

  /**
   * -----------------------------------------
   * Cancel Subscription
   * -----------------------------------------
   */
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
        cancelAtPeriodEnd: data?.cancelAtPeriodEnd ?? false,
        currentPeriodEnd: data?.currentPeriodEnd ?? null,
        error: null,
      };
    } catch (error: any) {
      return {
        success: false,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
        error: error?.message || 'Unable to cancel subscription.',
      };
    }
  }

  /**
   * -----------------------------------------
   * Sync Subscription Status
   * -----------------------------------------
   */
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
        synced: data?.synced ?? false,

        changed: data?.changed ?? false,

        status: data?.status ?? null,

        error: null,
      };
    } catch (error: any) {
      return {
        synced: false,
        changed: false,
        status: null,
        error: error?.message || 'Unable to sync subscription.',
      };
    }
  }
}
