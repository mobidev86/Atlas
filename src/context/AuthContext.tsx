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
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DiningPreferences,
  TravelPreferences,
  UserProfile,
} from '../types/UserProfile';
import { ONBOARDING_KEY } from '../config/constants';
import { Subscription } from '../types/Subscription';
import { RealtimeChannel } from '@supabase/supabase-js';
import { ProfileService } from '../services/profileService';

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

  /**
   * This only represents the initial auth/session restoration.
   *
   * IMPORTANT:
   * We no longer keep this true while waiting for subscription.
   */
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const [isSubscriptionLoading, setIsSubscriptionLoading] = useState(false);
  const [subscriptionChecked, setSubscriptionChecked] = useState(false);

  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  const profileChannelRef = useRef<RealtimeChannel | null>(null);

  /**
   * -----------------------------------------
   * Initial Auth Initialization
   * -----------------------------------------
   *
   * IMPORTANT:
   *
   * Session restoration and subscription
   * loading are now separate.
   *
   * Once we know the user is logged in,
   * we allow the app to proceed immediately.
   *
   * Subscription is refreshed in the
   * background.
   */
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const onboardingFlag = await AsyncStorage.getItem(ONBOARDING_KEY);

        if (!mounted) {
          return;
        }

        setHasCompletedOnboarding(onboardingFlag === 'true');

        /**
         * Restore the Supabase session.
         */
        const result = await AuthService.restoreSession();

        if (!mounted) {
          return;
        }

        setUser(result.user);

        /**
         * ---------------------------------------
         * Authenticated user
         * ---------------------------------------
         *
         * IMPORTANT:
         *
         * Do NOT mark subscription as checked here.
         *
         * subscriptionChecked = false means:
         *
         * "We have a user, but subscription
         * information is still being resolved."
         *
         * authRouteState intentionally treats this
         * state as HOME so the subscription request
         * cannot block or flash the SubscriptionScreen.
         */
        if (result.user) {
          setSubscriptionChecked(false);

          /**
           * Background subscription refresh.
           *
           * We intentionally do NOT await this.
           *
           * The user can enter Home immediately.
           */
          refreshSubscription(result.user).catch(error => {
            console.error('Background subscription refresh failed:', error);
          });
        } else {
          /**
           * No logged-in user.
           *
           * There is no subscription to resolve.
           */
          setSubscription(null);
          setSubscriptionChecked(true);
        }
      } catch (error) {
        console.error('initAuth failed:', error);

        if (mounted) {
          setUser(null);
          setSubscription(null);
          setSubscriptionChecked(true);
        }
      } finally {
        if (mounted) {
          /**
           * Session restoration is complete.
           *
           * IMPORTANT:
           *
           * This only controls the initial loading screen.
           * It does NOT mean subscription checking is complete.
           */
          setIsInitialLoading(false);
        }
      }
    };

    initAuth();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        /**
         * Supabase fires INITIAL_SESSION immediately
         * when the listener is registered.
         *
         * initAuth() already handles that.
         */
        if (_event === 'INITIAL_SESSION') {
          return;
        }

        /**
         * ---------------------------------------
         * Logged out
         * ---------------------------------------
         */
        if (!session) {
          setUser(null);
          setSubscription(null);
          setSubscriptionChecked(false);
          setIsSubscriptionLoading(false);

          return;
        }

        /**
         * ---------------------------------------
         * Logged in / session changed
         * ---------------------------------------
         */
        setSubscriptionChecked(false);

        try {
          /**
           * Fetch profile.
           */
          const profile = await ProfileService.getCurrentProfile();

          if (!mounted) {
            return;
          }

          setUser(profile.user);

          if (profile.user) {
            /**
             * For login/session changes we still
             * fetch the subscription.
             *
             * However, we don't need to block the
             * auth session restoration itself.
             */
            await refreshSubscription(profile.user);
          } else {
            setSubscriptionChecked(true);
          }
        } catch (error) {
          console.error('onAuthStateChange profile handling failed:', error);

          if (mounted) {
            setSubscriptionChecked(true);
          }
        }
      },
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * -----------------------------------------
   * Profile Realtime Subscription
   * -----------------------------------------
   */
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
          /**
           * User was banned from dashboard.
           */
          if (payload.new.is_banned) {
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

  /**
   * -----------------------------------------
   * Subscription Refresh
   * -----------------------------------------
   */
  const refreshSubscription = async (resolvedUser?: UserProfile | null) => {
    const currentUser = resolvedUser !== undefined ? resolvedUser : user;

    if (!currentUser) {
      setSubscription(null);
      setSubscriptionChecked(true);
      return;
    }

    try {
      setIsSubscriptionLoading(true);

      const { subscription } = await SubscriptionService.getCurrentSubscription(
        currentUser.id,
      );

      setSubscription(subscription);
    } catch (err) {
      console.error('refreshSubscription failed:', err);

      setSubscription(null);
    } finally {
      setIsSubscriptionLoading(false);
      setSubscriptionChecked(true);
    }
  };

  /**
   * -----------------------------------------
   * Login
   * -----------------------------------------
   */
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

      /**
       * Supabase onAuthStateChange handles:
       *
       * user
       * profile
       * subscription
       */
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

  /**
   * -----------------------------------------
   * Register
   * -----------------------------------------
   */
  const register = async (email: string, password: string, name?: string) => {
    try {
      setIsLoading(true);
      setSubscriptionChecked(false);

      const result = await AuthService.register(email, password, name);

      setUser(result.user);

      if (result.user) {
        await SubscriptionService.createStripeCustomer();

        await refreshSubscription(result.user);
      } else {
        setSubscriptionChecked(true);
      }

      return {
        success: !!result.user,
        error: result.error,
      };
    } catch (error: any) {
      setSubscriptionChecked(true);

      return {
        success: false,
        error: error.message ?? 'Registration failed.',
      };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * -----------------------------------------
   * Logout
   * -----------------------------------------
   */
  const logout = async () => {
    await AuthService.logout();

    setUser(null);
    setSubscription(null);
    setSubscriptionChecked(false);
  };

  /**
   * -----------------------------------------
   * Refresh Profile
   * -----------------------------------------
   */
  const refreshProfile = async () => {
    const result = await ProfileService.getCurrentProfile();

    if (result.user) {
      setUser(result.user);
    }
  };

  /**
   * -----------------------------------------
   * Onboarding
   * -----------------------------------------
   */
  const completeOnboarding = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');

    setHasCompletedOnboarding(true);
  };

  /**
   * -----------------------------------------
   * Subscribe
   * -----------------------------------------
   */
  const subscribe = async () => {
    const { success, customerId, error } =
      await SubscriptionService.subscribeUser();

    return {
      success,
      customerId,
      error,
    };
  };

  /**
   * -----------------------------------------
   * Travel Preferences
   * -----------------------------------------
   */
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

  /**
   * -----------------------------------------
   * Dining Preferences
   * -----------------------------------------
   */
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

  /**
   * -----------------------------------------
   * Auto Book
   * -----------------------------------------
   */
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

  /**
   * -----------------------------------------
   * Zero Retention
   * -----------------------------------------
   */
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

  /**
   * -----------------------------------------
   * Auth Route State
   * -----------------------------------------
   *
   * IMPORTANT:
   *
   * For an authenticated user, we allow Home
   * immediately while the subscription request
   * is running.
   *
   * Once the subscription response arrives,
   * this state automatically becomes either:
   *
   * home
   *
   * or
   *
   * subscription
   */
  const authRouteState: AuthRouteState = useMemo(() => {
    if (!hasCompletedOnboarding) {
      return 'onboarding';
    }

    if (!user) {
      return 'auth';
    }

    /**
     * Subscription is still being resolved.
     *
     * IMPORTANT:
     *
     * Always allow authenticated users into Home
     * while this request is running.
     */
    if (!subscriptionChecked) {
      return 'home';
    }

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
