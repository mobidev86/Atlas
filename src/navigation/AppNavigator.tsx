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

function AuthScreenContainer({ route, navigation }: AuthScreenWrapperProps) {
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

// SetupIntent client secrets are formatted as "seti_xxx_secret_yyy"
function extractSetupIntentId(clientSecret: string): string {
  return clientSecret.split('_secret_')[0];
}

function SubscribeScreenContainer({ navigation }: SubscribeScreenWrapperProps) {
  const { logout, refreshSubscription, user } = useAuth();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTrialEligible, setIsTrialEligible] = useState<boolean | null>(null); // null = still checking

  const handleSubscribe = async (
    tier: 'standard' | 'executive' = 'executive',
  ) => {
    if (Platform.OS === 'ios') {
      // Apple IAP flow goes here — separate piece, not built yet
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);

      // Step 1: create-trial-setup — creates a SetupIntent, no charge yet
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

      // Step 2: hand off to Stripe's native PaymentSheet to collect the card
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'Atlas',
        customerId: setupResult.customerId,
        customerEphemeralKeySecret: setupResult.ephemeralKeySecret,
        setupIntentClientSecret: setupResult.setupIntentClientSecret,
        allowsDelayedPaymentMethods: false,
      });

      if (initError) {
        setError(initError.message);
        return;
      }

      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        // User canceled, or card was declined — not necessarily a "real" error
        if (presentError.code !== 'Canceled') {
          setError(presentError.message);
        }
        return;
      }

      // Step 3: card saved successfully — now actually create the trial subscription
      const setupIntentId = extractSetupIntentId(
        setupResult.setupIntentClientSecret,
      );
      const confirmResult = await SubscriptionService.confirmTrialSubscription(
        setupIntentId,
      );

      if (confirmResult.error) {
        setError(confirmResult.error);
        return;
      }

      // Refresh AuthContext's subscription state so authRouteState flips
      // to 'home' — the app navigates itself from here, no manual nav call.
      await refreshSubscription(user);
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong.');
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (Platform.OS === 'android' && user) {
      SubscriptionService.createStripeCustomer(); // no-op if already exists
    }
    SubscriptionService.getTrialEligibility().then(result => {
      setIsTrialEligible(result.isEligible);
    });
  }, []);

  return (
    <SubscribeScreen
      onSubscribe={handleSubscribe}
      onBack={async () => {
        await logout();
        // Don't manually navigate here — logout() flips authRouteState to
        // 'auth', and AppNavigator's ref-based reset picks that up and
        // shows the Auth screen on its own. Manual navigate() would fight
        // with that and leave a stale session behind.
      }}
      isProcessing={isProcessing}
      error={error}
      isTrialEligible={isTrialEligible ?? true}
    />
  );
}

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

function ReplyScreenContainer({ navigation }: ReplyScreenWrapperProps) {
  return (
    <MainLayout
      title="Sarah Kim"
      subtitle="Reply"
      onBack={() => navigation.goBack()}
    >
      <ReplyScreen
        onSend={() => navigation.navigate('MainTabs', { screen: 'Inbox' })}
      />
    </MainLayout>
  );
}

function ConfirmScreenContainer({
  route,
  navigation,
}: ConfirmScreenWrapperProps) {
  const confirmation = route.params.confirmation;
  return (
    <MainLayout
      title="Confirmed"
      subtitle="Your booking is ready"
      onBack={() => navigation.goBack()}
    >
      <ConfirmScreen confirmation={confirmation} />
    </MainLayout>
  );
}

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
        style={{ marginTop: 24 }}
      />
    </View>
  );
}

type ResolvedRouteState = Exclude<AuthRouteState, 'loading'>;

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

export function AppNavigator() {
  const { authRouteState, isLoading, isInitialLoading } = useAuth();

  // null = nothing applied yet. Only ever set when we've either dispatched
  // a reset for this route, or confirmed the navigator already mounted on it.
  const appliedRouteStateRef = useRef<ResolvedRouteState | null>(null);
  const [isNavReady, setIsNavReady] = useState(false);

  const initialRoute = routeStateToScreen(
    authRouteState === 'loading' ? 'auth' : authRouteState,
  );

  useEffect(() => {
    if (authRouteState === 'loading') return;
    if (!isNavReady || !navigationRef.isReady()) return;
    if (appliedRouteStateRef.current === authRouteState) return; // already applied, skip

    const targetScreen = routeStateToScreen(authRouteState);

    // If this is the very first time we're applying anything, and the
    // navigator already mounted on the correct screen via initialRouteName,
    // just record it — no need to dispatch a reset and cause a redundant
    // transition/double-render.
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
        routes: [{ name: targetScreen }],
      }),
    );
  }, [authRouteState, isNavReady, initialRoute]);

  if (isInitialLoading) {
    return <LoadingScreen />;
  }

  const showOverlay = isLoading || authRouteState === 'loading';

  return (
    <View style={navStyles.container}>
      <NavigationContainer
        ref={navigationRef}
        onReady={() => setIsNavReady(true)}
      >
        <Stack.Navigator
          screenOptions={{ headerShown: false }}
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

      {showOverlay && (
        <View style={navStyles.overlay}>
          <View style={navStyles.spinnerCard}>
            <ActivityIndicator size="large" color="#233A5E" />
          </View>
        </View>
      )}
    </View>
  );
}

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
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  spinnerCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    shadowColor: '#0F172A',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
});
