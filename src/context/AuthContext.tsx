import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useMemo,
} from 'react';
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
import { Subscription } from '../types/Subscription';
import { RealtimeChannel } from '@supabase/supabase-js';

export type AuthRouteState =
  | 'loading'
  | 'onboarding'
  | 'auth'
  | 'subscription'
  | 'home';

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  isInitialLoading: boolean;
  hasCompletedOnboarding: boolean;
  subscription: Subscription | null;
  isSubscriptionLoading: boolean;
  subscriptionChecked: boolean;
  authRouteState: AuthRouteState;
  refreshSubscription: (user?: UserProfile | null) => Promise<void>;
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
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isSubscriptionLoading, setIsSubscriptionLoading] = useState(false);
  const [subscriptionChecked, setSubscriptionChecked] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const profileChannelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const onboardingFlag = await AsyncStorage.getItem(ONBOARDING_KEY);
        setHasCompletedOnboarding(onboardingFlag === 'true');
        const result = await AuthService.restoreSession();
        setUser(result.user);
        if (result.user) {
          await refreshSubscription(result.user);
        }
      } finally {
        setIsInitialLoading(false);
      }
    };

    initAuth();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        // Skip the event Supabase fires immediately on subscribe — initAuth()
        // already handles the cold-start session restore. Without this guard,
        // both paths run concurrently and briefly reset subscriptionChecked,
        // causing a second loading flash right after the first.
        if (_event === 'INITIAL_SESSION') {
          return;
        }
        if (!session) {
          setUser(null);
          setSubscription(null);
          setSubscriptionChecked(false);
          return;
        }

        // Reset before checking — this user's subscription status
        // hasn't been confirmed yet, so authRouteState should stay
        // in 'loading' until refreshSubscription completes below.
        setSubscriptionChecked(false);

        const profile = await ProfileService.getCurrentProfile();
        setUser(profile.user);

        if (profile.user) {
          await refreshSubscription(profile.user);
        }
      },
    );

    return () => {
      listener.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime subscription for profile flags (auto_book_enabled,
  // zero_retention_enabled) — picks up changes made from the Supabase
  // dashboard (or anywhere else) and merges them into `user` live,
  // with no user interaction required in the app.
  useEffect(() => {
    if (profileChannelRef.current) {
      supabase.removeChannel(profileChannelRef.current);
      profileChannelRef.current = null;
    }

    if (!user?.id) {
      return;
    }

    const channel = supabase
      .channel(`profile-settings-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        async payload => {
          if (payload.new.is_banned) {
            // User was banned from the dashboard — force logout immediately,
            // no user interaction needed.
            await logout();
            return;
          }

          setUser(prev =>
            prev
              ? {
                  ...prev,
                  autoBookEnabled: payload.new.auto_book_enabled,
                  zeroRetentionEnabled: payload.new.zero_retention_enabled,
                }
              : prev,
          );
        },
      )
      .subscribe();

    profileChannelRef.current = channel;

    return () => {
      if (profileChannelRef.current) {
        supabase.removeChannel(profileChannelRef.current);
        profileChannelRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const refreshSubscription = async (resolvedUser?: UserProfile | null) => {
    // Accept an explicit user argument to avoid stale closure issues
    // (e.g. when called immediately after setUser inside login/register,
    // or from the onAuthStateChange listener which closes over stale state)
    const currentUser = resolvedUser !== undefined ? resolvedUser : user;
    if (!currentUser) {
      setSubscription(null);
      setSubscriptionChecked(true);
      return;
    }

    try {
      setIsSubscriptionLoading(true);
      const { subscription } =
        await SubscriptionService.getCurrentSubscription();
      setSubscription(subscription);
    } catch (err) {
      console.error('refreshSubscription failed:', err);
      setSubscription(null);
    } finally {
      setIsSubscriptionLoading(false);
      setSubscriptionChecked(true);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);

      const result = await AuthService.login(email, password);

      if (result.user === null) {
        return {
          success: false,
          error: result.error || 'Login failed.',
        };
      }

      // Don't fetch profile/subscription here — signing in triggers
      // Supabase's onAuthStateChange listener above, which handles
      // setUser + refreshSubscription. Doing it here too would create
      // two competing writers to the same state (a race condition).
      return {
        success: true,
        error: null,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string, name?: string) => {
    setIsLoading(true);
    setSubscriptionChecked(false);
    const result = await AuthService.register(email, password, name);
    setUser(result.user);
    if (result.user) {
      // Pass the resolved user directly to avoid stale closure in refreshSubscription
      await SubscriptionService.createStripeCustomer();
      await refreshSubscription(result.user);
    } else {
      setSubscriptionChecked(true);
    }
    setIsLoading(false);
    return {
      success: !!result.user,
      error: result.error,
    };
  };

  const logout = async () => {
    await AuthService.logout();
    setUser(null);
    setSubscription(null);
    setSubscriptionChecked(false);
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
    const { success, customerId, error } =
      await SubscriptionService.subscribeUser();
    return {
      success,
      customerId,
      error,
    };
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
    subscription?.status === 'active' || subscription?.status === 'trialing';

  const authRouteState: AuthRouteState = useMemo(() => {
    if (!hasCompletedOnboarding) return 'onboarding';
    if (!user) return 'auth';
    if (!subscriptionChecked) return 'loading';
    return isSubscribed ? 'home' : 'subscription';
  }, [hasCompletedOnboarding, user, subscriptionChecked, isSubscribed]);

  return (
    <AuthContext.Provider
      value={{
        user,
        subscription,
        isSubscriptionLoading,
        subscriptionChecked,
        authRouteState,
        refreshSubscription,
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
