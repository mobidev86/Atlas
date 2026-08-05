import React, { useEffect, useState } from 'react';
import { View, StatusBar } from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import styles from './src/styles/styles';
import {
  SplashScreen,
  AuthScreen,
  SubscribeScreen,
  OnboardScreen,
  HomeScreen,
  TravelScreen,
  DiningScreen,
  InboxScreen,
  ReplyScreen,
  ConfirmScreen,
  ProfileScreen,
} from './src/screens';
import { MainLayout } from './src/components/MainLayout';
import { AuthMode, ScreenName, TabKey, ConfirmationState } from './src/types';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { AuthService } from './src/services/authService';

function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar barStyle="dark-content" backgroundColor="#F5F7FB" />
        <AppContent />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function AppContent() {
  const safeAreaInsets = useSafeAreaInsets();
  const [screen, setScreen] = useState<ScreenName>('');
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [confirmation, setConfirmation] = useState<ConfirmationState>({
    item: '',
    provider: '',
    price: '',
    subtitle: 'Added to your itinerary',
  });
  const {
    user,
    isLoading,
    logout,
    hasCompletedOnboarding,
    completeOnboarding,
    isSubscribed,
    subscribe,
  } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (user) {
      if (!isSubscribed) {
        if (screen !== 'subscribe' && screen !== 'onboard') {
          setScreen('subscribe');
        }
      } else {
        if (screen !== 'onboard') {
          setScreen('home');
        }
      }
    } else if (!hasCompletedOnboarding) {
      setScreen('splash');
    } else if (
      screen !== 'register' &&
      screen !== 'subscribe' &&
      screen !== 'onboard'
    ) {
      setScreen('login');
    }
  }, [user, isLoading, hasCompletedOnboarding]);

  const navigateTo = (nextScreen: ScreenName, nextTab?: TabKey) => {
    setScreen(nextScreen);
    if (nextTab) {
      setActiveTab(nextTab);
    }
  };

  const bookItem = (item: string, provider: string, price: string) => {
    setConfirmation({
      item,
      provider,
      price,
      subtitle: `Booked via ${provider}`,
    });
    setScreen('confirm');
  };

  const formatCurrentDate = () => {
    const date = new Date();

    const weekday = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
    }).format(date);

    const monthDay = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    }).format(date);

    return `${weekday} · ${monthDay}`;
  };

  const renderScreen = () => {
    switch (screen) {
      case 'login':
      case 'register':
        return (
          <AuthScreen
            authMode={authMode}
            onSwitchMode={() => {
              const nextMode = authMode === 'login' ? 'register' : 'login';
              setAuthMode(nextMode);
              setScreen(nextMode);
            }}
            onSubmit={(success: boolean) => {
              if (success) {
                navigateTo(authMode === 'register' ? 'subscribe' : 'home');
              }
            }}
          />
        );
      case 'subscribe':
        return (
          <SubscribeScreen
            onSubscribe={() => navigateTo('onboard')}
            onBack={() => {
              setAuthMode('login');
              navigateTo('login');
            }}
          />
        );
      case 'onboard':
        return (
          <OnboardScreen
            onContinue={async () => {
              const { success, error } = await subscribe();
              if (!success) {
                return; // stay on onboard screen if it fails
              }
              navigateTo('home');
            }}
          />
        );
      case 'travel':
        return (
          <MainLayout
            title="Travel & hotels"
            subtitle="Where to next?"
            onBack={() => navigateTo('home')}
            activeTab={activeTab}
            onTabPress={tab => {
              setActiveTab(tab);
              navigateTo(tab, tab);
            }}
          >
            <TravelScreen onBook={bookItem} />
          </MainLayout>
        );
      case 'dining':
        return (
          <MainLayout
            title="Dining"
            subtitle="Find a table"
            onBack={() => navigateTo('home')}
            activeTab={activeTab}
            onTabPress={tab => {
              setActiveTab(tab);
              navigateTo(tab, tab);
            }}
          >
            <DiningScreen onBook={bookItem} />
          </MainLayout>
        );
      case 'inbox':
        return (
          <MainLayout
            title="Inbox"
            subtitle="Today's priority mail"
            onBack={() => navigateTo('home')}
            activeTab={activeTab}
            onTabPress={tab => {
              setActiveTab(tab);
              navigateTo(tab, tab);
            }}
          >
            <InboxScreen onOpenReply={() => navigateTo('reply')} />
          </MainLayout>
        );
      case 'reply':
        return (
          <MainLayout
            title="Sarah Kim"
            subtitle="Reply"
            onBack={() => navigateTo('inbox')}
            activeTab={activeTab}
            onTabPress={tab => {
              setActiveTab(tab);
              navigateTo(tab, tab);
            }}
          >
            <ReplyScreen onSend={() => navigateTo('inbox')} />
          </MainLayout>
        );
      case 'confirm':
        return (
          <MainLayout
            title="Confirmed"
            subtitle="Your booking is ready"
            onBack={() => navigateTo('home')}
            activeTab={activeTab}
            onTabPress={tab => {
              setActiveTab(tab);
              navigateTo(tab, tab);
            }}
          >
            <ConfirmScreen confirmation={confirmation} />
          </MainLayout>
        );
      case 'profile':
        return (
          <MainLayout
            title="Profile"
            subtitle="Your preferences"
            onBack={() => navigateTo('home')}
            activeTab={activeTab}
            onTabPress={tab => {
              setActiveTab(tab);
              navigateTo(tab, tab);
            }}
          >
            <ProfileScreen
              onLogout={async () => {
                await logout();
                navigateTo('login');
              }}
            />
          </MainLayout>
        );
      case 'home':
        return (
          <MainLayout
            title={`Hello, ${user?.fullName ?? 'Traveler'}`}
            subtitle={formatCurrentDate()}
            onBack={async () => {
              await logout();
              navigateTo('login');
            }}
            activeTab={activeTab}
            onTabPress={tab => {
              setActiveTab(tab);
              navigateTo(tab, tab);
            }}
          >
            <HomeScreen
              onOpenTravel={() => navigateTo('travel')}
              onOpenDining={() => navigateTo('dining')}
              onOpenInbox={() => navigateTo('inbox')}
            />
          </MainLayout>
        );
      case 'splash':
        return (
          <SplashScreen
            onStart={async () => {
              await completeOnboarding();
              navigateTo('login');
            }}
            onSkip={async () => {
              await completeOnboarding();
              navigateTo('home');
            }}
          />
        );
      default:
        return <View />;
    }
  };

  return (
    <View
      style={[
        styles.screenRoot,
        {
          paddingTop: safeAreaInsets.top,
          paddingBottom: safeAreaInsets.bottom,
        },
      ]}
    >
      {renderScreen()}
      {/* {isLoading ? <View></View> : renderScreen()} */}
    </View>
  );
}

export default App;
