import { ENV } from '../config/env';
import { UserProfile } from '../types';

const MOCK_USER: UserProfile = {
  id: 'usr_omar_123',
  email: 'omar@executive.com',
  fullName: 'Omar Al-Hassan',
  subscriptionStatus: 'active',
  subscriptionTier: 'executive',
  autoBookEnabled: false,
  zeroRetentionEnabled: true,
  travelPreferences: {
    seatType: 'aisle',
    minHotelRating: 4,
    cabinClass: 'business',
    preferredAirlines: ['Emirates', 'British Airways'],
  },
  diningPreferences: {
    ambiance: 'quiet',
    dietaryRestrictions: ['no shellfish'],
    preferredCuisines: ['French', 'Japanese', 'Italian'],
  },
  nylasGrantId: 'grant_123_nylas',
  nylasAccountStatus: 'connected',
  lastEmailSyncedAt: new Date(Date.now() - 60000).toISOString(),
};

export class AuthService {
  private static currentUser: UserProfile | null = null;

  /**
   * Log in user with email & password
   */
  static async login(email: string, password?: string): Promise<{ user: UserProfile | null; error: string | null }> {
    try {
      if (!email || !email.includes('@')) {
        return { user: null, error: 'Please enter a valid email address.' };
      }

      // In production, call Supabase Auth endpoint: supabase.auth.signInWithPassword({ email, password })
      // For current serverless configuration:
      this.currentUser = {
        ...MOCK_USER,
        email,
      };

      return { user: this.currentUser, error: null };
    } catch (err: any) {
      return { user: null, error: err.message || 'Login failed' };
    }
  }

  /**
   * Register a new user
   */
  static async register(email: string, password?: string, fullName?: string): Promise<{ user: UserProfile | null; error: string | null }> {
    try {
      if (!email || !email.includes('@')) {
        return { user: null, error: 'Please enter a valid email address.' };
      }
      if (password && password.length < 6) {
        return { user: null, error: 'Password must be at least 6 characters long.' };
      }

      // In production, call Supabase Auth endpoint: supabase.auth.signUp({ email, password })
      this.currentUser = {
        ...MOCK_USER,
        id: `usr_${Date.now()}`,
        email,
        fullName: fullName || email.split('@')[0],
        subscriptionStatus: 'none', // Requires subscription step
      };

      return { user: this.currentUser, error: null };
    } catch (err: any) {
      return { user: null, error: err.message || 'Registration failed' };
    }
  }

  /**
   * Get current session user
   */
  static async getCurrentUser(): Promise<UserProfile | null> {
    return this.currentUser;
  }

  /**
   * Sign out
   */
  static async logout(): Promise<void> {
    this.currentUser = null;
  }

  /**
   * Update active user profile
   */
  static updateUserProfile(updates: Partial<UserProfile>): UserProfile | null {
    if (this.currentUser) {
      this.currentUser = {
        ...this.currentUser,
        ...updates,
      };
    }
    return this.currentUser;
  }
}
