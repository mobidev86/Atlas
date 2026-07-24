import { AuthService } from './authService';
import { TravelPreferences, DiningPreferences, UserProfile } from '../types';

export class ProfileService {
  /**
   * Get user profile details
   */
  static async getProfile(): Promise<UserProfile | null> {
    return AuthService.getCurrentUser();
  }

  /**
   * Update user travel preferences
   */
  static updateTravelPreferences(prefs: Partial<TravelPreferences>): UserProfile | null {
    const user = AuthService.getCurrentUser();
    if (!user) return null;

    return AuthService.updateUserProfile({
      travelPreferences: {
        ...user.travelPreferences,
        ...prefs,
      },
    });
  }

  /**
   * Update user dining preferences
   */
  static updateDiningPreferences(prefs: Partial<DiningPreferences>): UserProfile | null {
    const user = AuthService.getCurrentUser();
    if (!user) return null;

    return AuthService.updateUserProfile({
      diningPreferences: {
        ...user.diningPreferences,
        ...prefs,
      },
    });
  }

  /**
   * Toggle auto-book on confirmation
   */
  static toggleAutoBook(): boolean {
    const user = AuthService.getCurrentUser();
    if (!user) return false;

    const nextState = !user.autoBookEnabled;
    AuthService.updateUserProfile({ autoBookEnabled: nextState });
    return nextState;
  }

  /**
   * Toggle zero-retention mode
   */
  static toggleZeroRetention(): boolean {
    const user = AuthService.getCurrentUser();
    if (!user) return true;

    const nextState = !user.zeroRetentionEnabled;
    AuthService.updateUserProfile({ zeroRetentionEnabled: nextState });
    return nextState;
  }
}
