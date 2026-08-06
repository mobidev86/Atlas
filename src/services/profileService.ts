import { supabase } from './supabase';

import { ProfileRow } from '../types/ProfileRow';
import { UserProfile } from '../types/UserProfile';

import { mapProfileRowToUser } from '../mappers/profileMapper';

export class ProfileService {
  /**
   * Get profile by user id
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
        .maybeSingle();

      if (error) {
        return {
          user: null,
          error: error.message,
        };
      }

      if (!data) {
        return {
          user: null,
          error: 'Profile not found.',
        };
      }

      return {
        user: mapProfileRowToUser(data as ProfileRow),
        error: null,
      };
    } catch (error: any) {
      return {
        user: null,
        error: error?.message ?? 'Unable to fetch profile.',
      };
    }
  }

  /**
   * Get currently logged in user's profile
   */
  static async getCurrentProfile(): Promise<{
    user: UserProfile | null;
    error: string | null;
  }> {
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        return {
          user: null,
          error: error.message,
        };
      }

      if (!user) {
        return {
          user: null,
          error: 'User is not authenticated.',
        };
      }

      return await this.getProfile(user.id);
    } catch (error: any) {
      return {
        user: null,
        error: error?.message ?? 'Unable to fetch current profile.',
      };
    }
  }

  /**
   * Get currently authenticated Supabase user
   */
  static async getCurrentAuthUser(): Promise<{
    user:
      | Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user']
      | null;
    error: string | null;
  }> {
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        return {
          user: null,
          error: error.message,
        };
      }

      return {
        user,
        error: null,
      };
    } catch (error: any) {
      return {
        user: null,
        error: error?.message ?? 'Unable to get authenticated user.',
      };
    }
  }

  /**
   * Update currently authenticated user's profile
   */
  static async updateCurrentProfile(updates: Partial<UserProfile>): Promise<{
    user: UserProfile | null;
    error: string | null;
  }> {
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        return {
          user: null,
          error: error.message,
        };
      }

      if (!user) {
        return {
          user: null,
          error: 'User is not authenticated.',
        };
      }

      return await this.updateProfile(user.id, updates);
    } catch (error: any) {
      return {
        user: null,
        error: error?.message ?? 'Unable to update current profile.',
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
      const payload: Partial<ProfileRow> = {
        id: profile.id,
        email: profile.email,
        full_name: profile.fullName ?? null,
        auto_book_enabled: profile.autoBookEnabled ?? false,
        zero_retention_enabled: profile.zeroRetentionEnabled ?? true,
        travel_preferences: profile.travelPreferences ?? null,
        dining_preferences: profile.diningPreferences ?? null,
        nylas_grant_id: profile.nylasGrantId ?? null,
        nylas_account_status: profile.nylasAccountStatus ?? 'disconnected',
      };

      const { data, error } = await supabase
        .from('profiles')
        .upsert(payload, {
          onConflict: 'id',
        })
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
        error: error?.message ?? 'Unable to create profile.',
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
      const updateData: Partial<ProfileRow> = {};

      if (updates.fullName !== undefined) {
        updateData.full_name = updates.fullName;
      }

      if (updates.autoBookEnabled !== undefined) {
        updateData.auto_book_enabled = updates.autoBookEnabled;
      }

      if (updates.zeroRetentionEnabled !== undefined) {
        updateData.zero_retention_enabled = updates.zeroRetentionEnabled;
      }

      if (updates.travelPreferences !== undefined) {
        updateData.travel_preferences = updates.travelPreferences;
      }

      if (updates.diningPreferences !== undefined) {
        updateData.dining_preferences = updates.diningPreferences;
      }

      if (updates.nylasGrantId !== undefined) {
        updateData.nylas_grant_id = updates.nylasGrantId;
      }

      if (updates.nylasAccountStatus !== undefined) {
        updateData.nylas_account_status = updates.nylasAccountStatus;
      }

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
        error: error?.message ?? 'Unable to update profile.',
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
        error: error?.message ?? 'Unable to delete profile.',
      };
    }
  }
}
