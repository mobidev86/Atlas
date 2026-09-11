import { supabase } from './supabase';
import { ProfileService } from './profileService';

import { UserProfile } from '../types/UserProfile';

import {
  DEFAULT_DINING_PREFERENCES,
  DEFAULT_TRAVEL_PREFERENCES,
} from '../config/constants';

export class AuthService {
  /**
   * -----------------------------------------
   * Login
   * -----------------------------------------
   */
  static async login(
    email: string,
    password: string,
  ): Promise<{
    user: UserProfile | null;
    error: string | null;
  }> {
    try {
      const normalizedEmail = email.trim().toLowerCase();

      if (!normalizedEmail) {
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
        email: normalizedEmail,
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

      /**
       * Resolve the actual application profile.
       *
       * Do NOT cast Supabase AuthUser to UserProfile.
       */
      const profile = await ProfileService.getCurrentProfile();

      if (!profile.user) {
        return {
          user: null,
          error: profile.error || 'Unable to load your profile.',
        };
      }

      return {
        user: profile.user,
        error: null,
      };
    } catch (error: any) {
      return {
        user: null,
        error: error?.message || 'Login failed.',
      };
    }
  }

  /**
   * -----------------------------------------
   * Register
   * -----------------------------------------
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
      const normalizedEmail = email.trim().toLowerCase();

      if (!normalizedEmail) {
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
        email: normalizedEmail,
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
       * Email verification enabled.
       *
       * User exists but there is no session yet.
       */
      if (!data.session) {
        return {
          user: null,
          error:
            'Verification email sent. Please verify your email before logging in.',
        };
      }

      /**
       * ---------------------------------------
       * Create application profile
       * ---------------------------------------
       *
       * We intentionally create it before
       * returning the UserProfile.
       *
       * This prevents AuthContext from temporarily
       * treating the raw Supabase auth user as an
       * application UserProfile.
       */
      const profile = await ProfileService.createProfile({
        id: data.user.id,
        email: data.user.email!,
        fullName,

        autoBookEnabled: false,
        zeroRetentionEnabled: true,

        travelPreferences: DEFAULT_TRAVEL_PREFERENCES,

        diningPreferences: DEFAULT_DINING_PREFERENCES,

        nylasAccountStatus: 'disconnected',
      });

      if (!profile.user) {
        return {
          user: null,
          error:
            profile.error ||
            'Account created, but unable to create your profile.',
        };
      }

      return {
        user: profile.user,
        error: null,
      };
    } catch (error: any) {
      return {
        user: null,
        error: error?.message || 'Registration failed.',
      };
    }
  }

  /**
   * -----------------------------------------
   * Restore Session
   * -----------------------------------------
   *
   * This is the ONLY place where we combine:
   *
   * Supabase session restoration
   * +
   * application profile loading
   *
   * during initial startup.
   */
  static async restoreSession(): Promise<{
    user: UserProfile | null;
    error: string | null;
  }> {
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        return {
          user: null,
          error: error.message,
        };
      }

      if (!session?.user) {
        return {
          user: null,
          error: null,
        };
      }

      /**
       * Session exists.
       *
       * Now load the application profile.
       */
      const profile = await ProfileService.getCurrentProfile();

      if (!profile.user) {
        return {
          user: null,
          error: profile.error || 'Unable to load your profile.',
        };
      }

      return {
        user: profile.user,
        error: null,
      };
    } catch (error: any) {
      return {
        user: null,
        error: error?.message || 'Unable to restore session.',
      };
    }
  }

  /**
   * -----------------------------------------
   * Current Logged In User
   * -----------------------------------------
   *
   * Kept for compatibility with existing code.
   *
   * IMPORTANT:
   *
   * This returns the application's UserProfile,
   * not merely the Supabase Auth user.
   *
   * SubscriptionService should NOT use this
   * when a userId is already known.
   */
  static async getCurrentUser(): Promise<{
    user: UserProfile | null;
    error: string | null;
  }> {
    return this.restoreSession();
  }

  /**
   * -----------------------------------------
   * Logout
   * -----------------------------------------
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
        error: error?.message || 'Unable to logout.',
      };
    }
  }

  /**
   * -----------------------------------------
   * Send Password Reset Email
   * -----------------------------------------
   */
  static async resetPassword(email: string): Promise<{
    success: boolean;
    error: string | null;
  }> {
    try {
      const normalizedEmail = email.trim().toLowerCase();

      if (!normalizedEmail) {
        return {
          success: false,
          error: 'Email is required.',
        };
      }

      const { error } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
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
        error: error?.message || 'Unable to send password reset email.',
      };
    }
  }

  /**
   * -----------------------------------------
   * Resend Verification Email
   * -----------------------------------------
   */
  static async resendVerificationEmail(email: string): Promise<{
    success: boolean;
    error: string | null;
  }> {
    try {
      const normalizedEmail = email.trim().toLowerCase();

      if (!normalizedEmail) {
        return {
          success: false,
          error: 'Email is required.',
        };
      }

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: normalizedEmail,
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
        error: error?.message || 'Unable to resend verification email.',
      };
    }
  }
}
