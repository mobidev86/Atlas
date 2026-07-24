import React, { useState } from 'react';
import { View, StatusBar } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { AuthProvider } from './src/context/AuthContext';

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
  const [screen, setScreen] = useState<ScreenName>('splash');
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [confirmation, setConfirmation] = useState<ConfirmationState>({
    item: '',
    provider: '',
    price: '',
    subtitle: 'Added to your itinerary',
  });

  const navigateTo = (nextScreen: ScreenName, nextTab?: TabKey) => {
    setScreen(nextScreen);
    if (nextTab) {
      setActiveTab(nextTab);
    }
  };

  const bookItem = (item: string, provider: string, price: string) => {
    setConfirmation({ item, provider, price, subtitle: `Booked via ${provider}` });
    setScreen('confirm');
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
            onSubmit={() => navigateTo(authMode === 'register' ? 'subscribe' : 'home')}
          />
        );
      case 'subscribe':
        return (
          <SubscribeScreen
            onSubscribe={() => navigateTo('onboard')}
            onBack={() => navigateTo('register')}
          />
        );
      case 'onboard':
        return <OnboardScreen onContinue={() => navigateTo('home')} />;
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
            }}>
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
            }}>
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
            }}>
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
            }}>
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
            }}>
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
            }}>
            <ProfileScreen onLogout={() => navigateTo('login')} />
          </MainLayout>
        );
      case 'home':
      default:
        return (
          <MainLayout
            title="Evening, Omar"
            subtitle="Thursday · Jul 16"
            onBack={() => navigateTo('splash')}
            activeTab={activeTab}
            onTabPress={tab => {
              setActiveTab(tab);
              navigateTo(tab, tab);
            }}>
            <HomeScreen
              onOpenTravel={() => navigateTo('travel')}
              onOpenDining={() => navigateTo('dining')}
              onOpenInbox={() => navigateTo('inbox')}
            />
          </MainLayout>
        );
      case 'splash':
        return <SplashScreen onStart={() => navigateTo('login')} onSkip={() => navigateTo('home')} />;
    }
  };

  return (
    <View
      style={[
        styles.screenRoot,
        { paddingTop: safeAreaInsets.top, paddingBottom: safeAreaInsets.bottom },
      ]}>
      {renderScreen()}
    </View>
  );
}

export default App;
