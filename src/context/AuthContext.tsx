import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
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

  subscribe: () => Promise<{
    success: boolean;
    error: string | null;
  }>;

  refreshProfile: () => Promise<void>;

  updateTravelPreferences: (prefs: Partial<TravelPreferences>) => Promise<void>;

  updateDiningPreferences: (prefs: Partial<DiningPreferences>) => Promise<void>;

  toggleAutoBook: () => Promise<void>;

  toggleZeroRetention: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);

  const [subscription, setSubscription] = useState<Subscription | null>(null);

  const [isLoading, setIsLoading] = useState(false);

  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const [isSubscriptionLoading, setIsSubscriptionLoading] = useState(false);

  const [subscriptionChecked, setSubscriptionChecked] = useState(false);

  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  const profileChannelRef = useRef<RealtimeChannel | null>(null);

  /**
   * ------------------------------------------------------------
   * INITIALIZATION STATE
   * ------------------------------------------------------------
   *
   * During startup, restoreSession() is the single owner of:
   *
   * Supabase session
   *        ↓
   * application profile
   *
   * Auth events received during this period are ignored.
   */
  const initializationCompleteRef = useRef(false);

  /**
   * Used to invalidate stale async auth operations.
   */
  const authOperationRef = useRef(0);

  /**
   * Prevent duplicate subscription requests for the
   * same user.
   */
  const subscriptionRequestRef = useRef<{
    userId: string | null;
    promise: Promise<void> | null;
  }>({
    userId: null,
    promise: null,
  });

  /**
   * Prevent duplicate processing of TOKEN_REFRESHED events.
   */
  const lastProcessedUserIdRef = useRef<string | null>(null);

  /**
   * IMPORTANT:
   *
   * login() and register() already resolve the complete
   * UserProfile themselves.
   *
   * While those methods are running, Supabase can emit
   * SIGNED_IN. We don't want the auth listener to call
   * ProfileService.getCurrentProfile() a second time.
   */
  const authActionInProgressRef = useRef(false);

  /**
   * ------------------------------------------------------------
   * REFRESH SUBSCRIPTION
   * ------------------------------------------------------------
   */
  const refreshSubscription = useCallback(
    async (resolvedUser?: UserProfile | null) => {
      const currentUser = resolvedUser !== undefined ? resolvedUser : user;

      if (!currentUser?.id) {
        setSubscription(null);
        setIsSubscriptionLoading(false);
        setSubscriptionChecked(true);

        subscriptionRequestRef.current = {
          userId: null,
          promise: null,
        };

        return;
      }

      const userId = currentUser.id;

      /**
       * Reuse an existing subscription request for
       * the same user.
       */
      if (
        subscriptionRequestRef.current.userId === userId &&
        subscriptionRequestRef.current.promise
      ) {
        await subscriptionRequestRef.current.promise;
        return;
      }

      const operationId = authOperationRef.current;

      /**
       * Create the promise without referencing a
       * not-yet-assigned const from inside itself.
       */
      const requestPromise = (async () => {
        try {
          setIsSubscriptionLoading(true);

          /**
           * IMPORTANT:
           *
           * userId is passed directly.
           *
           * SubscriptionService therefore does not need
           * to resolve the authenticated user again.
           */
          const result = await SubscriptionService.getCurrentSubscription(
            userId,
          );

          /**
           * Ignore stale results if the authentication
           * operation has changed.
           */
          if (operationId !== authOperationRef.current) {
            return;
          }

          /**
           * Make sure the result still belongs to the
           * currently displayed user.
           */
          setUser(currentUserState => {
            if (!currentUserState || currentUserState.id !== userId) {
              return currentUserState;
            }

            return currentUserState;
          });

          /**
           * Your SubscriptionService returns:
           *
           * {
           *   subscription: Subscription | null;
           *   error: string | null;
           * }
           *
           * Use the existing Subscription type from
           * ../types/Subscription.
           */
          setSubscription(result.subscription ?? null);

          if (result.error) {
            console.warn('[AuthContext] Subscription lookup:', result.error);
          }
        } catch (error) {
          console.error('[AuthContext] refreshSubscription failed:', error);

          if (operationId === authOperationRef.current) {
            setSubscription(null);
          }
        } finally {
          if (operationId === authOperationRef.current) {
            setIsSubscriptionLoading(false);
            setSubscriptionChecked(true);
          }

          /**
           * Clear request tracking only if this still
           * belongs to the same user.
           */
          if (subscriptionRequestRef.current.userId === userId) {
            subscriptionRequestRef.current = {
              userId: null,
              promise: null,
            };
          }
        }
      })();

      subscriptionRequestRef.current = {
        userId,
        promise: requestPromise,
      };

      await requestPromise;
    },
    [user],
  );

  /**
   * ------------------------------------------------------------
   * INITIAL AUTH INITIALIZATION
   * ------------------------------------------------------------
   */
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        /**
         * ------------------------------------------------------
         * Load onboarding state
         * ------------------------------------------------------
         */
        const onboardingFlag = await AsyncStorage.getItem(ONBOARDING_KEY);

        if (!mounted) {
          return;
        }

        setHasCompletedOnboarding(onboardingFlag === 'true');

        /**
         * ------------------------------------------------------
         * Restore auth session + profile
         * ------------------------------------------------------
         *
         * This is the ONLY initial profile resolution.
         */
        const result = await AuthService.restoreSession();

        if (!mounted) {
          return;
        }

        if (result.user) {
          /**
           * Actual application UserProfile.
           */
          setUser(result.user);

          lastProcessedUserIdRef.current = result.user.id;

          /**
           * Start subscription lookup in background.
           *
           * DO NOT await this.
           */
          refreshSubscription(result.user).catch(error => {
            console.error(
              '[AuthContext] Background subscription refresh failed:',
              error,
            );
          });
        } else {
          /**
           * No authenticated user.
           */
          setUser(null);
          setSubscription(null);
          setSubscriptionChecked(true);
        }
      } catch (error) {
        console.error('[AuthContext] initAuth failed:', error);

        if (mounted) {
          setUser(null);
          setSubscription(null);
          setSubscriptionChecked(true);
        }
      } finally {
        if (mounted) {
          /**
           * VERY IMPORTANT:
           *
           * Always mark initial initialization complete.
           *
           * Do NOT use authOperationRef to decide whether
           * this should happen.
           */
          initializationCompleteRef.current = true;

          setIsInitialLoading(false);
        }
      }
    };

    void initAuth();

    /**
     * ------------------------------------------------------------
     * SUPABASE AUTH LISTENER
     * ------------------------------------------------------------
     */
    const {
      data: { subscription: authListener },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      /**
       * INITIAL_SESSION is handled by initAuth().
       */
      if (event === 'INITIAL_SESSION') {
        return;
      }

      /**
       * During initial startup, initAuth() owns
       * session/profile restoration.
       *
       * Ignore auth events here.
       */
      if (!initializationCompleteRef.current) {
        return;
      }

      /**
       * ------------------------------------------------------
       * LOGIN / REGISTER
       * ------------------------------------------------------
       *
       * AuthService.login() / register() already loads
       * ProfileService.getCurrentProfile().
       *
       * Don't do it again from this listener.
       */
      if (authActionInProgressRef.current) {
        return;
      }

      const operationId = ++authOperationRef.current;

      /**
       * ------------------------------------------------------
       * SIGNED OUT
       * ------------------------------------------------------
       */
      if (event === 'SIGNED_OUT' || !session?.user) {
        subscriptionRequestRef.current = {
          userId: null,
          promise: null,
        };

        lastProcessedUserIdRef.current = null;

        setUser(null);
        setSubscription(null);
        setSubscriptionChecked(true);
        setIsSubscriptionLoading(false);

        return;
      }

      /**
       * ------------------------------------------------------
       * TOKEN REFRESH
       * ------------------------------------------------------
       *
       * A token refresh does not need another profile
       * request when we already have the same user.
       */
      if (
        event === 'TOKEN_REFRESHED' &&
        lastProcessedUserIdRef.current === session.user.id
      ) {
        return;
      }

      try {
        setSubscriptionChecked(false);

        /**
         * For genuine auth changes occurring after
         * startup, resolve the application profile.
         */
        const profile = await ProfileService.getCurrentProfile();

        /**
         * Ignore stale auth event.
         */
        if (!mounted || operationId !== authOperationRef.current) {
          return;
        }

        if (!profile.user) {
          setUser(null);
          setSubscription(null);
          setSubscriptionChecked(true);

          return;
        }

        /**
         * Make sure the returned profile belongs
         * to the current Supabase auth user.
         */
        if (profile.user.id !== session.user.id) {
          console.warn('[AuthContext] Profile/auth user mismatch.');

          return;
        }

        lastProcessedUserIdRef.current = profile.user.id;

        setUser(profile.user);

        /**
         * Clear previous subscription immediately
         * when switching users.
         */
        setSubscription(null);

        /**
         * Background subscription lookup.
         */
        refreshSubscription(profile.user).catch(error => {
          console.error(
            '[AuthContext] Auth event subscription refresh failed:',
            error,
          );
        });
      } catch (error) {
        console.error(
          '[AuthContext] Auth event profile handling failed:',
          error,
        );

        if (mounted && operationId === authOperationRef.current) {
          setUser(null);
          setSubscription(null);
          setSubscriptionChecked(true);
        }
      }
    });

    return () => {
      mounted = false;

      authListener.unsubscribe();

      if (profileChannelRef.current) {
        void supabase.removeChannel(profileChannelRef.current);

        profileChannelRef.current = null;
      }
    };

    // This initialization/listener effect must run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * ------------------------------------------------------------
   * PROFILE REALTIME SUBSCRIPTION
   * ------------------------------------------------------------
   */
  useEffect(() => {
    if (profileChannelRef.current) {
      void supabase.removeChannel(profileChannelRef.current);

      profileChannelRef.current = null;
    }

    if (!user?.id) {
      return;
    }

    const userId = user.id;

    const channel = supabase
      .channel(`profile-settings-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        async payload => {
          /**
           * User banned.
           */
          if (payload.new.is_banned) {
            await logout();
            return;
          }

          setUser(previousUser => {
            if (!previousUser || previousUser.id !== userId) {
              return previousUser;
            }

            return {
              ...previousUser,

              autoBookEnabled: payload.new.auto_book_enabled,

              zeroRetentionEnabled: payload.new.zero_retention_enabled,
            };
          });
        },
      )
      .subscribe();

    profileChannelRef.current = channel;

    return () => {
      if (profileChannelRef.current === channel) {
        void supabase.removeChannel(channel);

        profileChannelRef.current = null;
      }
    };

    // logout is intentionally excluded because changing
    // logout's callback identity must not recreate this channel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  /**
   * ------------------------------------------------------------
   * LOGIN
   * ------------------------------------------------------------
   */
  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);

      /**
       * Invalidate previous async subscription work.
       */
      authOperationRef.current += 1;

      subscriptionRequestRef.current = {
        userId: null,
        promise: null,
      };

      /**
       * Clear old subscription while login is happening.
       */
      setSubscription(null);
      setSubscriptionChecked(false);

      /**
       * Prevent SIGNED_IN listener from fetching the
       * profile a second time.
       */
      authActionInProgressRef.current = true;

      const result = await AuthService.login(email, password);

      if (!result.user) {
        setSubscription(null);
        setSubscriptionChecked(true);

        return {
          success: false,
          error: result.error || 'Login failed.',
        };
      }

      /**
       * AuthService already resolved the complete
       * UserProfile.
       */
      setUser(result.user);

      lastProcessedUserIdRef.current = result.user.id;

      /**
       * Subscription lookup happens in background.
       */
      void refreshSubscription(result.user);

      return {
        success: true,
        error: null,
      };
    } catch (error: any) {
      setSubscription(null);
      setSubscriptionChecked(true);

      return {
        success: false,
        error: error?.message || 'Login failed.',
      };
    } finally {
      /**
       * Allow subsequent auth events to be handled.
       */
      authActionInProgressRef.current = false;

      setIsLoading(false);
    }
  };

  /**
   * ------------------------------------------------------------
   * REGISTER
   * ------------------------------------------------------------
   */
  const register = async (email: string, password: string, name?: string) => {
    try {
      setIsLoading(true);

      authOperationRef.current += 1;

      subscriptionRequestRef.current = {
        userId: null,
        promise: null,
      };

      setSubscription(null);
      setSubscriptionChecked(false);

      /**
       * Prevent SIGNED_IN from causing another
       * profile lookup while AuthService.register()
       * is already doing it.
       */
      authActionInProgressRef.current = true;

      const result = await AuthService.register(email, password, name);

      if (!result.user) {
        setSubscriptionChecked(true);

        return {
          success: false,
          error: result.error || 'Registration failed.',
        };
      }

      setUser(result.user);

      lastProcessedUserIdRef.current = result.user.id;

      void refreshSubscription(result.user);

      return {
        success: true,
        error: null,
      };
    } catch (error: any) {
      setSubscriptionChecked(true);

      return {
        success: false,
        error: error?.message || 'Registration failed.',
      };
    } finally {
      authActionInProgressRef.current = false;

      setIsLoading(false);
    }
  };

  /**
   * ------------------------------------------------------------
   * LOGOUT
   * ------------------------------------------------------------
   */
  const logout = async () => {
    /**
     * Invalidate all outstanding auth operations.
     */
    authOperationRef.current += 1;

    /**
     * Invalidate subscription request.
     */
    subscriptionRequestRef.current = {
      userId: null,
      promise: null,
    };

    lastProcessedUserIdRef.current = null;

    try {
      await AuthService.logout();
    } finally {
      setUser(null);
      setSubscription(null);
      setSubscriptionChecked(true);
      setIsSubscriptionLoading(false);
    }
  };

  /**
   * ------------------------------------------------------------
   * REFRESH PROFILE
   * ------------------------------------------------------------
   */
  const refreshProfile = async () => {
    try {
      const result = await ProfileService.getCurrentProfile();

      if (result.user) {
        setUser(result.user);

        /**
         * Refresh subscription against the newly
         * resolved profile.
         */
        void refreshSubscription(result.user);
      }
    } catch (error) {
      console.error('[AuthContext] refreshProfile failed:', error);
    }
  };

  /**
   * ------------------------------------------------------------
   * COMPLETE ONBOARDING
   * ------------------------------------------------------------
   */
  const completeOnboarding = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');

    setHasCompletedOnboarding(true);
  };

  /**
   * ------------------------------------------------------------
   * SUBSCRIBE
   * ------------------------------------------------------------
   */
  const subscribe = async () => {
    try {
      const result = await SubscriptionService.subscribeUser();

      /**
       * We don't need customerId in AuthContext.
       */
      return {
        success: result.success,
        error: result.error,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Unable to subscribe.',
      };
    }
  };

  /**
   * ------------------------------------------------------------
   * TRAVEL PREFERENCES
   * ------------------------------------------------------------
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
   * ------------------------------------------------------------
   * DINING PREFERENCES
   * ------------------------------------------------------------
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
   * ------------------------------------------------------------
   * AUTO BOOK
   * ------------------------------------------------------------
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
   * ------------------------------------------------------------
   * ZERO RETENTION
   * ------------------------------------------------------------
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

  /**
   * ------------------------------------------------------------
   * DERIVED AUTH STATE
   * ------------------------------------------------------------
   */
  const isAuthenticated = !!user;

  const isSubscribed =
    subscription?.status === 'active' || subscription?.status === 'trialing';

  /**
   * ------------------------------------------------------------
   * ROUTE STATE
   * ------------------------------------------------------------
   *
   * Subscription loading does NOT block Home.
   */
  const authRouteState = useMemo<AuthRouteState>(() => {
    if (isInitialLoading) {
      return 'loading';
    }

    if (!hasCompletedOnboarding) {
      return 'onboarding';
    }

    if (!user) {
      return 'auth';
    }

    /**
     * User is authenticated.
     *
     * Don't wait for subscription lookup.
     */
    if (!subscriptionChecked) {
      return 'home';
    }

    return isSubscribed ? 'home' : 'subscription';
  }, [
    isInitialLoading,
    hasCompletedOnboarding,
    user,
    subscriptionChecked,
    isSubscribed,
  ]);

  /**
   * ------------------------------------------------------------
   * CONTEXT VALUE
   * ------------------------------------------------------------
   */
  const contextValue = useMemo<AuthContextType>(
    () => ({
      user,

      isAuthenticated,
      isSubscribed,

      isLoading,
      isInitialLoading,

      hasCompletedOnboarding,

      subscription,

      isSubscriptionLoading,
      subscriptionChecked,

      authRouteState,

      refreshSubscription,

      completeOnboarding,

      login,
      register,
      logout,

      subscribe,

      refreshProfile,

      updateTravelPreferences,
      updateDiningPreferences,

      toggleAutoBook,
      toggleZeroRetention,
    }),
    [
      user,

      isAuthenticated,
      isSubscribed,

      isLoading,
      isInitialLoading,

      hasCompletedOnboarding,

      subscription,

      isSubscriptionLoading,
      subscriptionChecked,

      authRouteState,

      refreshSubscription,
    ],
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};

/**
 * ------------------------------------------------------------
 * useAuth
 * ------------------------------------------------------------
 */
export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
};

export default AuthContext;
