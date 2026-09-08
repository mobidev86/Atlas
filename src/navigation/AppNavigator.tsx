import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import {
  NavigationContainer,
  createNavigationContainerRef,
  CommonActions,
} from '@react-navigation/native';
import {
  createNativeStackNavigator,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';

import { RootStackParamList } from '../types/navigation';
import { AuthMode } from '../types';
import { useAuth, AuthRouteState } from '../context/AuthContext';

import { MainTabNavigator } from './MainTabNavigator';
import { MainLayout } from '../components/MainLayout';

import styles from '../styles/styles';

import {
  SplashScreen,
  AuthScreen,
  SubscribeScreen,
  OnboardScreen,
  ReplyScreen,
  ConfirmScreen,
} from '../screens';

import { SubscriptionService } from '../services/subscriptionService';
import { useStripe } from '@stripe/stripe-react-native';
import LoadingOverlay from '../components/LoadingOverlay';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navigationRef = createNavigationContainerRef<RootStackParamList>();

type SplashScreenProps = NativeStackScreenProps<RootStackParamList, 'Splash'>;

type AuthScreenWrapperProps = NativeStackScreenProps<
  RootStackParamList,
  'Auth'
>;

type SubscribeScreenWrapperProps = NativeStackScreenProps<
  RootStackParamList,
  'Subscribe'
>;

type OnboardScreenWrapperProps = NativeStackScreenProps<
  RootStackParamList,
  'Onboard'
>;

type ReplyScreenWrapperProps = NativeStackScreenProps<
  RootStackParamList,
  'Reply'
>;

type ConfirmScreenWrapperProps = NativeStackScreenProps<
  RootStackParamList,
  'Confirm'
>;

/**
 * -----------------------------------------
 * Splash
 * -----------------------------------------
 */
function SplashScreenContainer({ navigation }: SplashScreenProps) {
  const { completeOnboarding } = useAuth();

  return (
    <SplashScreen
      onStart={async () => {
        await completeOnboarding();
      }}
      onSkip={async () => {
        await completeOnboarding();
      }}
    />
  );
}

/**
 * -----------------------------------------
 * Auth
 * -----------------------------------------
 */
function AuthScreenContainer({ route }: AuthScreenWrapperProps) {
  const [authMode, setAuthMode] = useState<AuthMode>(
    route.params?.initialMode ?? 'login',
  );

  return (
    <AuthScreen
      authMode={authMode}
      onSwitchMode={() => {
        setAuthMode(prev => (prev === 'login' ? 'register' : 'login'));
      }}
    />
  );
}

/**
 * -----------------------------------------
 * SetupIntent helper
 * -----------------------------------------
 */
function extractSetupIntentId(clientSecret: string): string {
  return clientSecret.split('_secret_')[0];
}

/**
 * -----------------------------------------
 * Subscribe
 * -----------------------------------------
 */
function SubscribeScreenContainer({ navigation }: SubscribeScreenWrapperProps) {
  const { logout, refreshSubscription, user } = useAuth();

  const { initPaymentSheet, presentPaymentSheet, handleNextAction } =
    useStripe();

  const [isProcessing, setIsProcessing] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [isTrialEligible, setIsTrialEligible] = useState<boolean | null>(null);

  const handleSubscribe = async (
    tier: 'standard' | 'executive' = 'executive',
  ) => {
    if (Platform.OS === 'ios') {
      return;
    }

    if (isProcessing) {
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);

      /**
       * Step 1:
       * Create trial setup.
       */
      const setupResult = await SubscriptionService.createTrialSetup(tier);

      if (
        setupResult.error ||
        !setupResult.setupIntentClientSecret ||
        !setupResult.customerId ||
        !setupResult.ephemeralKeySecret
      ) {
        setError(setupResult.error ?? 'Failed to start checkout.');

        return;
      }

      /**
       * Step 2:
       * PaymentSheet.
       */
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'Atlas',

        customerId: setupResult.customerId,

        customerEphemeralKeySecret: setupResult.ephemeralKeySecret,

        setupIntentClientSecret: setupResult.setupIntentClientSecret,

        allowsDelayedPaymentMethods: false,

        returnURL: 'atlas://stripe-redirect',
      });

      if (initError) {
        setError(initError.message);
        return;
      }

      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code !== 'Canceled') {
          setError(presentError.message);
        }

        return;
      }

      /**
       * Step 3:
       * Card saved successfully.
       */
      const setupIntentId = extractSetupIntentId(
        setupResult.setupIntentClientSecret,
      );

      const confirmResult = await SubscriptionService.confirmTrialSubscription(
        setupIntentId,
      );

      if (!confirmResult.success) {
        setError(confirmResult.error);

        return;
      }

      /**
       * Resolve 3DS.
       */
      if (
        confirmResult.paymentIntentStatus === 'requires_action' &&
        confirmResult.paymentIntentClientSecret
      ) {
        const { error: nextActionError, paymentIntent } =
          await handleNextAction(confirmResult.paymentIntentClientSecret);

        if (nextActionError) {
          setError(
            nextActionError.message ?? '3D Secure authentication failed.',
          );

          return;
        }

        if (paymentIntent?.status !== 'Succeeded') {
          setError('Payment could not be completed. Please try again.');

          return;
        }
      }

      /**
       * Refresh subscription after
       * successful subscription.
       */
      await refreshSubscription(user);
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong.');
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * -----------------------------------------
   * Trial eligibility
   * -----------------------------------------
   */
  useEffect(() => {
    if (Platform.OS === 'android' && user) {
      SubscriptionService.createStripeCustomer();
    }

    SubscriptionService.getTrialEligibility().then(result => {
      setIsTrialEligible(result.isEligible);
    });
  }, [user]);

  return (
    <SubscribeScreen
      onSubscribe={handleSubscribe}
      onBack={async () => {
        await logout();
      }}
      isProcessing={isProcessing}
      error={error}
      isTrialEligible={isTrialEligible ?? true}
    />
  );
}

/**
 * -----------------------------------------
 * Onboarding
 * -----------------------------------------
 */
function OnboardScreenContainer({ navigation }: OnboardScreenWrapperProps) {
  const { subscribe } = useAuth();

  return (
    <OnboardScreen
      onContinue={async () => {
        await subscribe();
      }}
    />
  );
}

/**
 * -----------------------------------------
 * Reply
 * -----------------------------------------
 */
function ReplyScreenContainer({ navigation }: ReplyScreenWrapperProps) {
  return (
    <MainLayout
      title="Sarah Kim"
      subtitle="Reply"
      onBack={() => navigation.goBack()}
    >
      <ReplyScreen
        onSend={() =>
          navigation.navigate('MainTabs', {
            screen: 'Inbox',
          })
        }
      />
    </MainLayout>
  );
}

/**
 * -----------------------------------------
 * Confirm
 * -----------------------------------------
 */
function ConfirmScreenContainer({
  route,
  navigation,
}: ConfirmScreenWrapperProps) {
  const confirmation = route.params.confirmation;

  const booking = route.params.booking;

  return (
    <MainLayout
      title="Booking Details"
      subtitle="Your booking status"
      onBack={() => navigation.goBack()}
    >
      <ConfirmScreen confirmation={confirmation} booking={booking} />
    </MainLayout>
  );
}

/**
 * -----------------------------------------
 * Initial Loading
 * -----------------------------------------
 */
function LoadingScreen() {
  return (
    <View style={navStyles.initialLoadingContainer}>
      <View style={styles.brandBadgeLarge}>
        <Text style={styles.brandBadgeText}>A</Text>
      </View>

      <Text style={styles.brandTitle}>Atlas</Text>

      <ActivityIndicator
        size="large"
        color="#233A5E"
        style={{
          marginTop: 24,
        }}
      />
    </View>
  );
}

/**
 * -----------------------------------------
 * Resolved Auth Route State
 * -----------------------------------------
 */
type ResolvedRouteState = Exclude<AuthRouteState, 'loading'>;

/**
 * -----------------------------------------
 * Route State → Screen
 * -----------------------------------------
 */
function routeStateToScreen(
  state: ResolvedRouteState,
): keyof RootStackParamList {
  switch (state) {
    case 'onboarding':
      return 'Splash';

    case 'auth':
      return 'Auth';

    case 'home':
      return 'MainTabs';

    case 'subscription':
      return 'Subscribe';
  }
}

/**
 * -----------------------------------------
 * App Navigator
 * -----------------------------------------
 */
export function AppNavigator() {
  const { authRouteState, isLoading, isInitialLoading } = useAuth();

  const appliedRouteStateRef = useRef<ResolvedRouteState | null>(null);

  const [isNavReady, setIsNavReady] = useState(false);

  /**
   * While initial auth/session restoration
   * is happening, use Auth as a temporary
   * navigator route.
   *
   * Once restoration completes,
   * authRouteState will determine the real
   * route.
   */
  const initialRoute = routeStateToScreen(
    authRouteState === 'loading' ? 'auth' : authRouteState,
  );

  /**
   * -----------------------------------------
   * Navigation Route Synchronization
   * -----------------------------------------
   */
  useEffect(() => {
    if (authRouteState === 'loading') {
      return;
    }

    if (!isNavReady || !navigationRef.isReady()) {
      return;
    }

    if (appliedRouteStateRef.current === authRouteState) {
      return;
    }

    const targetScreen = routeStateToScreen(authRouteState);

    /**
     * First route application.
     */
    if (
      appliedRouteStateRef.current === null &&
      targetScreen === initialRoute
    ) {
      appliedRouteStateRef.current = authRouteState;

      return;
    }

    appliedRouteStateRef.current = authRouteState;

    navigationRef.dispatch(
      CommonActions.reset({
        index: 0,

        routes: [
          {
            name: targetScreen,
          },
        ],
      }),
    );
  }, [authRouteState, isNavReady, initialRoute]);

  /**
   * -----------------------------------------
   * Initial Loading
   * -----------------------------------------
   *
   * IMPORTANT:
   *
   * Use isInitialLoading here, NOT isLoading.
   *
   * isLoading is for actions such as login,
   * registration and subscription.
   */
  if (isInitialLoading) {
    return <LoadingScreen />;
  }

  /**
   * -----------------------------------------
   * Loading Overlay
   * -----------------------------------------
   *
   * Only show the overlay for:
   *
   * - explicit auth operations
   * - unresolved auth route
   *
   * Subscription checking no longer blocks
   * startup.
   */
  const showOverlay = isLoading || authRouteState === 'loading';

  /**
   * -----------------------------------------
   * Navigation
   * -----------------------------------------
   */
  return (
    <View style={navStyles.container}>
      <NavigationContainer
        ref={navigationRef}
        onReady={() => setIsNavReady(true)}
      >
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
          }}
          initialRouteName={initialRoute}
        >
          <Stack.Screen name="Splash" component={SplashScreenContainer} />

          <Stack.Screen name="Auth" component={AuthScreenContainer} />

          <Stack.Screen name="Subscribe" component={SubscribeScreenContainer} />

          <Stack.Screen name="Onboard" component={OnboardScreenContainer} />

          <Stack.Screen name="MainTabs" component={MainTabNavigator} />

          <Stack.Screen name="Reply" component={ReplyScreenContainer} />

          <Stack.Screen name="Confirm" component={ConfirmScreenContainer} />
        </Stack.Navigator>
      </NavigationContainer>

      <LoadingOverlay visible={showOverlay} />
    </View>
  );
}

/**
 * -----------------------------------------
 * Navigation Styles
 * -----------------------------------------
 */
const navStyles = StyleSheet.create({
  container: {
    flex: 1,
  },

  initialLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F7FB',
  },
});
