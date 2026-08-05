import { UserProfile } from '../types/UserProfile';
import { AuthService } from './authService';
import { ProfileService } from './profileService';

export class SubscriptionService {
  /**
   * Verify if the user has an active subscription to access features
   */
  static async checkSubscription(): Promise<boolean> {
    const { user } = await AuthService.getCurrentUser();
    if (!user) return false;
    return (
      user.subscriptionStatus === 'active' ||
      user.subscriptionStatus === 'trialing'
    );
  }

  /**
   * Process subscription activation (Stripe flow integration)
   */
  static async subscribeUser(
    planTier: 'executive' | 'standard' = 'executive',
  ): Promise<{
    success: boolean;
    user: UserProfile | null;
    error: string | null;
  }> {
    try {
      const { user } = await AuthService.getCurrentUser();
      if (!user) {
        return {
          success: false,
          user: null,
          error: 'User not authenticated.',
        };
      }

      const { user: updatedUser, error } = await ProfileService.updateProfile(
        user.id,
        {
          subscriptionStatus: 'active',
          subscriptionTier: planTier,
        },
      );

      if (!updatedUser) {
        return {
          success: false,
          user: null,
          error: error || 'Unable to update subscription.',
        };
      }

      return {
        success: true,
        user: updatedUser,
        error: null,
      };
    } catch (err: any) {
      return {
        success: false,
        user: null,
        error: err.message || 'Subscription failed. Please try again.',
      };
    }
  }

  /**
   * Cancel subscription
   */
  static async cancelSubscription(): Promise<{
    success: boolean;
    error: string | null;
  }> {
    try {
      const { user } = await AuthService.getCurrentUser();
      if (!user) {
        return { success: false, error: 'User not authenticated.' };
      }

      await ProfileService.updateProfile(user.id, {
        subscriptionStatus: 'canceled',
      });
      return { success: true, error: null };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Failed to cancel subscription',
      };
    }
  }
}
