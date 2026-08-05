import { supabase } from './supabase';
import { ProfileService } from './profileService';

import { UserProfile } from '../types/UserProfile';

import {
  DEFAULT_DINING_PREFERENCES,
  DEFAULT_TRAVEL_PREFERENCES,
} from '../config/constants';

export class AuthService {
  /**
   * Login
   */
  static async login(
    email: string,
    password: string,
  ): Promise<{
    user: UserProfile | null;
    error: string | null;
  }> {
    try {
      if (!email.trim()) {
        return {
          user: null,
          error: 'Email is required.',
        };
      }

      if (!password.trim()) {
        return {
          user: null,
          error: 'Password is required.',
        };
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
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
          error: 'Unable to login.',
        };
      }

      return await ProfileService.getCurrentProfile();
    } catch (error: any) {
      return {
        user: null,
        error: error?.message ?? 'Login failed.',
      };
    }
  }

  /**
   * Register
   */
  static async register(
    email: string,
    password: string,
    fullName?: string,
  ): Promise<{
    user: UserProfile | null;
    error: string | null;
  }> {
    try {
      if (!email.trim()) {
        return {
          user: null,
          error: 'Email is required.',
        };
      }

      if (password.length < 6) {
        return {
          user: null,
          error: 'Password must be at least 6 characters.',
        };
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: fullName ?? '',
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
          error: 'Unable to register user.',
        };
      }

      /**
       * Email verification enabled
       *
       * User exists
       * Session does not.
       */
      if (!data.session) {
        return {
          user: null,
          error:
            'Verification email sent. Please verify your email before logging in.',
        };
      }

      const profile = await ProfileService.createProfile({
        id: data.user.id,
        email: data.user.email!,
        fullName,

        subscriptionStatus: 'none',

        autoBookEnabled: false,

        zeroRetentionEnabled: true,

        travelPreferences: DEFAULT_TRAVEL_PREFERENCES,

        diningPreferences: DEFAULT_DINING_PREFERENCES,

        nylasAccountStatus: 'disconnected',
      });

      return profile;
    } catch (error: any) {
      return {
        user: null,
        error: error?.message ?? 'Registration failed.',
      };
    }
  }

  /**
   * Restore session
   */
  static async restoreSession(): Promise<{
    user: UserProfile | null;
    error: string | null;
  }> {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        return {
          user: null,
          error: null,
        };
      }

      return await ProfileService.getCurrentProfile();
    } catch (error: any) {
      return {
        user: null,
        error: error?.message ?? 'Unable to restore session.',
      };
    }
  }

  /**
   * Current logged in user
   */
  static async getCurrentUser(): Promise<{
    user: UserProfile | null;
    error: string | null;
  }> {
    return this.restoreSession();
  }

  /**
   * Logout
   */
  static async logout(): Promise<{
    success: boolean;
    error: string | null;
  }> {
    try {
      const { error } = await supabase.auth.signOut();

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
        error: error?.message ?? 'Unable to logout.',
      };
    }
  }

  /**
   * Send password reset email
   */
  static async resetPassword(email: string): Promise<{
    success: boolean;
    error: string | null;
  }> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
      );

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
        error: error?.message ?? 'Unable to send reset password email.',
      };
    }
  }

  /**
   * Resend verification email
   */
  static async resendVerificationEmail(email: string): Promise<{
    success: boolean;
    error: string | null;
  }> {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim().toLowerCase(),
      });

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
        error: error?.message ?? 'Unable to resend verification email.',
      };
    }
  }
}
