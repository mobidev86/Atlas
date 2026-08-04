import { ProfileRow } from '../types/ProfileRow';
import { UserProfile } from '../types/UserProfile';

import { mapProfileRowToUser } from '../mappers/profileMapper';
import { supabase } from './supabase';

export class ProfileService {
  /**
   * Get user profile
   */
  static async getProfile(userId: string): Promise<{
    user: UserProfile | null;
    error: string | null;
  }> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        return {
          user: null,
          error: error.message,
        };
      }

      return {
        user: mapProfileRowToUser(data as ProfileRow),
        error: null,
      };
    } catch (error: any) {
      return {
        user: null,
        error: error.message ?? 'Unable to fetch profile',
      };
    }
  }

  /**
   * Create profile after signup
   */
  static async createProfile(profile: Partial<UserProfile>): Promise<{
    user: UserProfile | null;
    error: string | null;
  }> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .upsert(
          {
            id: profile.id,
            email: profile.email,
            full_name: profile.fullName ?? null,
            stripe_customer_id: profile.stripeCustomerId ?? null,
            subscription_status: profile.subscriptionStatus ?? 'none',
            subscription_tier: profile.subscriptionTier ?? null,
            auto_book_enabled: profile.autoBookEnabled ?? false,
            zero_retention_enabled: profile.zeroRetentionEnabled ?? true,
            travel_preferences: profile.travelPreferences ?? {},
            dining_preferences: profile.diningPreferences ?? {},
            nylas_grant_id: profile.nylasGrantId ?? null,
            nylas_account_status: profile.nylasAccountStatus ?? 'disconnected',
          },
          { onConflict: 'id' }, // if id already exists, update instead of erroring
        )
        .select()
        .single();

      if (error) {
        return {
          user: null,
          error: error.message,
        };
      }

      return {
        user: mapProfileRowToUser(data as ProfileRow),
        error: null,
      };
    } catch (error: any) {
      return {
        user: null,
        error: error.message ?? 'Unable to create profile',
      };
    }
  }

  /**
   * Update profile
   */
  static async updateProfile(
    userId: string,
    updates: Partial<UserProfile>,
  ): Promise<{
    user: UserProfile | null;
    error: string | null;
  }> {
    try {
      const updateData: any = {};

      if (updates.fullName !== undefined)
        updateData.full_name = updates.fullName;

      if (updates.autoBookEnabled !== undefined)
        updateData.auto_book_enabled = updates.autoBookEnabled;

      if (updates.zeroRetentionEnabled !== undefined)
        updateData.zero_retention_enabled = updates.zeroRetentionEnabled;

      if (updates.travelPreferences !== undefined)
        updateData.travel_preferences = updates.travelPreferences;

      if (updates.diningPreferences !== undefined)
        updateData.dining_preferences = updates.diningPreferences;

      const { data, error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        return {
          user: null,
          error: error.message,
        };
      }

      return {
        user: mapProfileRowToUser(data as ProfileRow),
        error: null,
      };
    } catch (error: any) {
      return {
        user: null,
        error: error.message ?? 'Unable to update profile',
      };
    }
  }

  /**
   * Delete profile
   */
  static async deleteProfile(userId: string): Promise<{
    success: boolean;
    error: string | null;
  }> {
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
        error: null,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message ?? 'Unable to delete profile',
      };
    }
  }
}
