import React, { useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { AuthMode } from '../types';
import { useAuth } from '../context/AuthContext';
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

const Stack = createNativeStackNavigator<RootStackParamList>();

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
        navigation.navigate('Auth', { initialMode: 'login' });
      }}
      onSkip={async () => {
        await completeOnboarding();
        navigation.navigate('MainTabs');
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
      onSubmit={(success: boolean) => {
        if (success) {
          if (authMode === 'register') {
            navigation.navigate('Subscribe');
          } else {
            navigation.navigate('MainTabs');
          }
        }
      }}
    />
  );
}

function SubscribeScreenContainer({
  navigation,
}: SubscribeScreenWrapperProps) {
  return (
    <SubscribeScreen
      onSubscribe={() => navigation.navigate('Onboard')}
      onBack={() => navigation.navigate('Auth', { initialMode: 'login' })}
    />
  );
}

function OnboardScreenContainer({ navigation }: OnboardScreenWrapperProps) {
  const { subscribe } = useAuth();
  return (
    <OnboardScreen
      onContinue={async () => {
        const { success } = await subscribe();
        if (success) {
          navigation.navigate('MainTabs');
        }
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

export function AppNavigator() {
  const { user, isLoading, isInitialLoading, hasCompletedOnboarding, isSubscribed } =
    useAuth();

  if (isInitialLoading) {
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

  return (
    <View style={navStyles.container}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {user ? (
            !isSubscribed ? (
              <>
                <Stack.Screen
                  name="Subscribe"
                  component={SubscribeScreenContainer}
                />
                <Stack.Screen
                  name="Onboard"
                  component={OnboardScreenContainer}
                />
                <Stack.Screen name="Auth" component={AuthScreenContainer} />
                <Stack.Screen name="MainTabs" component={MainTabNavigator} />
              </>
            ) : (
              <>
                <Stack.Screen name="MainTabs" component={MainTabNavigator} />
                <Stack.Screen name="Reply" component={ReplyScreenContainer} />
                <Stack.Screen
                  name="Confirm"
                  component={ConfirmScreenContainer}
                />
                <Stack.Screen
                  name="Subscribe"
                  component={SubscribeScreenContainer}
                />
                <Stack.Screen
                  name="Onboard"
                  component={OnboardScreenContainer}
                />
                <Stack.Screen name="Auth" component={AuthScreenContainer} />
              </>
            )
          ) : !hasCompletedOnboarding ? (
            <>
              <Stack.Screen name="Splash" component={SplashScreenContainer} />
              <Stack.Screen name="Auth" component={AuthScreenContainer} />
              <Stack.Screen
                name="Subscribe"
                component={SubscribeScreenContainer}
              />
              <Stack.Screen name="Onboard" component={OnboardScreenContainer} />
              <Stack.Screen name="MainTabs" component={MainTabNavigator} />
            </>
          ) : (
            <>
              <Stack.Screen name="Auth" component={AuthScreenContainer} />
              <Stack.Screen
                name="Subscribe"
                component={SubscribeScreenContainer}
              />
              <Stack.Screen name="Onboard" component={OnboardScreenContainer} />
              <Stack.Screen name="MainTabs" component={MainTabNavigator} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>

      {isLoading && (
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
