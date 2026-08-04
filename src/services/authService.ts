import { supabase } from './supabase';
import { UserProfile } from '../types/UserProfile';
import { ProfileService } from './profileService';
import { ProfileRow } from '../types/ProfileRow';
import { mapProfileRowToUser } from '../mappers/profileMapper';

export class AuthService {
  private static currentUser: UserProfile | null = null;

  /**
   * Login user with email & password
   */
  static async login(
    email: string,
    password?: string,
  ): Promise<{ user: UserProfile | null; error: string | null }> {
    try {
      if (!email || !email.includes('@')) {
        return {
          user: null,
          error: 'Please enter a valid email address.',
        };
      }

      if (!password) {
        return {
          user: null,
          error: 'Password is required.',
        };
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return {
          user: null,
          error: error.message,
        };
      }

      if (!data.user) {
        return {
          user: null,
          error: 'Unable to login user.',
        };
      }

      // Fetch profile from profiles table
      const profileResponse = await ProfileService.getProfile(data.user.id);

      if (profileResponse.error) {
        return {
          user: null,
          error: profileResponse.error,
        };
      }

      this.currentUser = profileResponse.user;

      return {
        user: this.currentUser,
        error: null,
      };
    } catch (error: any) {
      return {
        user: null,
        error: error.message ?? 'Login failed',
      };
    }
  }

  /**
   * Register new user
   */
  static async register(
    email: string,
    password?: string,
    fullName?: string,
  ): Promise<{ user: UserProfile | null; error: string | null }> {
    try {
      if (!email || !email.includes('@')) {
        return {
          user: null,
          error: 'Please enter a valid email address.',
        };
      }

      if (!password || password.length < 6) {
        return {
          user: null,
          error: 'Password must be at least 6 characters long.',
        };
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName ?? email.split('@')[0],
          },
        },
      });
      if (error) {
        return {
          user: null,
          error: error.message,
        };
      }

      if (!data.user) {
        return {
          user: null,
          error: 'Unable to create account.',
        };
      }
      // Create profile row
      const profileResponse = await ProfileService.createProfile({
        id: data.user.id,
        email: email,
        fullName: fullName ?? email.split('@')[0],

        subscriptionStatus: 'none',

        autoBookEnabled: false,
        zeroRetentionEnabled: true,

        travelPreferences: {
          seatType: 'aisle',
          minHotelRating: 4,
          cabinClass: 'business',
          preferredAirlines: [],
        },

        diningPreferences: {
          ambiance: 'quiet',
          dietaryRestrictions: [],
          preferredCuisines: [],
        },

        nylasAccountStatus: 'disconnected',
      });
      if (profileResponse.error) {
        return {
          user: null,
          error: profileResponse.error,
        };
      }

      this.currentUser = profileResponse.user;

      return {
        user: this.currentUser,
        error: null,
      };
    } catch (error: any) {
      return {
        user: null,
        error: error.message ?? 'Registration failed',
      };
    }
  }

  /**
   * Get current logged-in user
   */
  static async getCurrentUser(): Promise<UserProfile | null> {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        this.currentUser = null;
        return null;
      }

      if (!this.currentUser) {
        const profileResponse = await ProfileService.getProfile(
          session.user.id,
        );

        this.currentUser = profileResponse.user;
      }

      return this.currentUser;
    } catch (error) {
      return null;
    }
  }

  /**
   * Logout
   */
  static async logout(): Promise<void> {
    await supabase.auth.signOut();
    this.currentUser = null;
  }

  /**
   * Update local user cache
   */
  static async updateUserProfile(
    updates: Partial<UserProfile>,
  ): Promise<UserProfile | null> {
    if (!this.currentUser) {
      return null;
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({
        subscription_status: updates.subscriptionStatus ?? undefined,
        subscription_tier: updates.subscriptionTier ?? undefined,
        full_name: updates.fullName ?? undefined,
        auto_book_enabled: updates.autoBookEnabled ?? undefined,
        zero_retention_enabled: updates.zeroRetentionEnabled ?? undefined,
        travel_preferences: updates.travelPreferences ?? undefined,
        dining_preferences: updates.diningPreferences ?? undefined,
        nylas_grant_id: updates.nylasGrantId ?? undefined,
        nylas_account_status: updates.nylasAccountStatus ?? undefined,
      })
      .eq('id', this.currentUser.id)
      .select()
      .single();

    if (error) {
      console.log('updateUserProfile error:', error.message);
      return null;
    }

    this.currentUser = mapProfileRowToUser(data as ProfileRow);
    return this.currentUser;
  }
}
