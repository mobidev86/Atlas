import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthService } from '../services/authService';
import { SubscriptionService } from '../services/subscriptionService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DiningPreferences,
  TravelPreferences,
  UserProfile,
} from '../types/UserProfile';

const ONBOARDING_KEY = 'hasCompletedOnboarding';

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  hasCompletedOnboarding: boolean; // ✅ new
  completeOnboarding: () => Promise<void>; // ✅ new, call this when "Get Started" is tapped
  login: (
    email: string,
    password?: string,
  ) => Promise<{ success: boolean; error: string | null }>;
  register: (
    email: string,
    password?: string,
    name?: string,
  ) => Promise<{ success: boolean; error: string | null }>;
  logout: () => Promise<void>;
  subscribe: () => Promise<{ success: boolean; error: string | null }>;
  updateTravelPreferences: (prefs: Partial<TravelPreferences>) => Promise<void>;
  updateDiningPreferences: (prefs: Partial<DiningPreferences>) => Promise<void>;
  toggleAutoBook: () => Promise<void>;
  toggleZeroRetention: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  useEffect(() => {
    // Initial session load
    const initAuth = async () => {
      // Check onboarding flag first
      const onboardingFlag = await AsyncStorage.getItem(ONBOARDING_KEY);
      setHasCompletedOnboarding(onboardingFlag === 'true');
    };
    AuthService.getCurrentUser().then(u => {
      setUser(u);
      setIsLoading(false);
    });
    initAuth();
  }, []);

  const login = async (email: string, password?: string) => {
    setIsLoading(true);
    const { user: loggedInUser, error } = await AuthService.login(
      email,
      password,
    );
    setIsLoading(false);
    if (error || !loggedInUser) {
      return { success: false, error: error || 'Login failed' };
    }
    setUser(loggedInUser);
    return { success: true, error: null };
  };

  const register = async (email: string, password?: string, name?: string) => {
    setIsLoading(true);
    const { user: registeredUser, error } = await AuthService.register(
      email,
      password,
      name,
    );
    setIsLoading(false);
    if (error || !registeredUser) {
      return { success: false, error: error || 'Registration failed' };
    }
    setUser(registeredUser);
    return { success: true, error: null };
  };

  const logout = async () => {
    await AuthService.logout();
    setUser(null);
  };

  const completeOnboarding = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    setHasCompletedOnboarding(true);
  };

  const subscribe = async () => {
    const {
      success,
      user: updatedUser,
      error,
    } = await SubscriptionService.subscribeUser();
    if (success && updatedUser) {
      setUser(updatedUser);
    }
    return { success, error };
  };

  const updateTravelPreferences = async (prefs: Partial<TravelPreferences>) => {
    if (!user) return;
    const updated = await AuthService.updateUserProfile({
      travelPreferences: { ...user.travelPreferences, ...prefs },
    });
    if (updated) setUser({ ...updated });
  };

  const updateDiningPreferences = async (prefs: Partial<DiningPreferences>) => {
    if (!user) return;
    const updated = await AuthService.updateUserProfile({
      diningPreferences: { ...user.diningPreferences, ...prefs },
    });
    if (updated) setUser({ ...updated });
  };

  const toggleAutoBook = async () => {
    if (!user) return;
    const updated = await AuthService.updateUserProfile({
      autoBookEnabled: !user.autoBookEnabled,
    });
    if (updated) setUser({ ...updated });
  };

  const toggleZeroRetention = async () => {
    if (!user) return;
    const updated = await AuthService.updateUserProfile({
      zeroRetentionEnabled: !user.zeroRetentionEnabled,
    });
    if (updated) setUser({ ...updated });
  };

  const isAuthenticated = !!user;
  const isSubscribed =
    !!user &&
    (user.subscriptionStatus === 'active' ||
      user.subscriptionStatus === 'trialing');

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isSubscribed,
        isLoading,
        hasCompletedOnboarding,
        completeOnboarding,
        login,
        register,
        logout,
        subscribe,
        updateTravelPreferences,
        updateDiningPreferences,
        toggleAutoBook,
        toggleZeroRetention,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
