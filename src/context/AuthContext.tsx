import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthService } from '../services/authService';
import { SubscriptionService } from '../services/subscriptionService';
import { supabase } from '../services/supabase';
import { ProfileService } from '../services/profileService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DiningPreferences,
  TravelPreferences,
  UserProfile,
} from '../types/UserProfile';
import { ONBOARDING_KEY } from '../config/constants';

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  isInitialLoading: boolean;
  hasCompletedOnboarding: boolean;
  completeOnboarding: () => Promise<void>;
  login: (
    email: string,
    password: string,
  ) => Promise<{
    success: boolean;
    error: string | null;
  }>;
  register: (
    email: string,
    password: string,
    name?: string,
  ) => Promise<{
    success: boolean;
    error: string | null;
  }>;
  logout: () => Promise<void>;
  subscribe: () => Promise<{ success: boolean; error: string | null }>;
  refreshProfile: () => Promise<void>;
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
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  /**
   * Restore session when app launches
   */
  useEffect(() => {
    const initAuth = async () => {
      try {
        const onboardingFlag = await AsyncStorage.getItem(ONBOARDING_KEY);
        setHasCompletedOnboarding(onboardingFlag === 'true');
        const result = await AuthService.restoreSession();
        setUser(result.user);
      } finally {
        setIsInitialLoading(false);
      }
    };
    initAuth();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!session) {
          setUser(null);
          return;
        }
        const profile = await ProfileService.getCurrentProfile();
        setUser(profile.user);
      },
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const restoreSession = async () => {
    setIsLoading(true);
    const result = await AuthService.restoreSession();
    setUser(result.user);
    setIsLoading(false);
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    const result = await AuthService.login(email, password);
    setUser(result.user);
    setIsLoading(false);
    return {
      success: !!result.user,
      error: result.error,
    };
  };

  const register = async (email: string, password: string, name?: string) => {
    setIsLoading(true);
    const result = await AuthService.register(email, password, name);
    setUser(result.user);
    setIsLoading(false);
    return {
      success: !!result.user,
      error: result.error,
    };
  };

  const logout = async () => {
    await AuthService.logout();
    setUser(null);
  };

  const refreshProfile = async () => {
    const result = await ProfileService.getCurrentProfile();
    if (result.user) {
      setUser(result.user);
    }
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
    if (!user) {
      return;
    }

    const result = await ProfileService.updateCurrentProfile({
      travelPreferences: {
        ...user.travelPreferences,
        ...prefs,
      },
    });

    if (result.user) {
      setUser(result.user);
    }
  };

  const updateDiningPreferences = async (prefs: Partial<DiningPreferences>) => {
    if (!user) {
      return;
    }

    const result = await ProfileService.updateCurrentProfile({
      diningPreferences: {
        ...user.diningPreferences,
        ...prefs,
      },
    });

    if (result.user) {
      setUser(result.user);
    }
  };

  const toggleAutoBook = async () => {
    if (!user) {
      return;
    }

    const result = await ProfileService.updateCurrentProfile({
      autoBookEnabled: !user.autoBookEnabled,
    });

    if (result.user) {
      setUser(result.user);
    }
  };

  const toggleZeroRetention = async () => {
    if (!user) {
      return;
    }

    const result = await ProfileService.updateCurrentProfile({
      zeroRetentionEnabled: !user.zeroRetentionEnabled,
    });

    if (result.user) {
      setUser(result.user);
    }
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
        isInitialLoading,
        hasCompletedOnboarding,
        completeOnboarding,
        login,
        register,
        logout,
        refreshProfile,
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
