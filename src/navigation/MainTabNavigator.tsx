import React, { useEffect, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainTabParamList, RootStackParamList } from '../types/navigation';
import { CustomTabBar } from './CustomTabBar';
import { MainLayout } from '../components/MainLayout';
import {
  HomeScreen,
  TravelScreen,
  DiningScreen,
  InboxScreen,
  ProfileScreen,
} from '../screens';
import { useAuth } from '../context/AuthContext';
import { Alert, Platform } from 'react-native';
import { SubscriptionService } from '../services/subscriptionService';

const Tab = createBottomTabNavigator<MainTabParamList>();

type HomeScreenNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type TravelScreenNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Travel'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type DiningScreenNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Dining'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type InboxScreenNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Inbox'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type ProfileScreenNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Profile'>,
  NativeStackNavigationProp<RootStackParamList>
>;

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

function HomeTabScreen({ navigation }: { navigation: HomeScreenNavProp }) {
  const { user, logout } = useAuth();

  return (
    <MainLayout
      title={`Hello, ${user?.fullName ?? 'Traveler'}`}
      subtitle={formatCurrentDate()}
      onBack={async () => {
        await logout();
        navigation.navigate('Auth', { initialMode: 'login' });
      }}
    >
      <HomeScreen
        onOpenTravel={() => navigation.navigate('Travel')}
        onOpenDining={() => navigation.navigate('Dining')}
        onOpenInbox={() => navigation.navigate('Inbox')}
      />
    </MainLayout>
  );
}

function TravelTabScreen({ navigation }: { navigation: TravelScreenNavProp }) {
  const handleBook = (item: string, provider: string, price: string) => {
    navigation.navigate('Confirm', {
      confirmation: {
        item,
        provider,
        price,
        subtitle: `Booked via ${provider}`,
      },
    });
  };

  return (
    <MainLayout
      title="Travel & hotels"
      subtitle="Where to next?"
      onBack={() => navigation.navigate('Home')}
    >
      <TravelScreen onBook={handleBook} />
    </MainLayout>
  );
}

function DiningTabScreen({ navigation }: { navigation: DiningScreenNavProp }) {
  const handleBook = (item: string, provider: string, price: string) => {
    navigation.navigate('Confirm', {
      confirmation: {
        item,
        provider,
        price,
        subtitle: `Booked via ${provider}`,
      },
    });
  };

  return (
    <MainLayout
      title="Dining"
      subtitle="Find a table"
      onBack={() => navigation.navigate('Home')}
    >
      <DiningScreen onBook={handleBook} />
    </MainLayout>
  );
}

function InboxTabScreen({ navigation }: { navigation: InboxScreenNavProp }) {
  return (
    <MainLayout
      title="Inbox"
      subtitle="Today's priority mail"
      onBack={() => navigation.navigate('Home')}
    >
      <InboxScreen onOpenReply={() => navigation.navigate('Reply')} />
    </MainLayout>
  );
}

function ProfileTabScreen({
  navigation,
}: {
  navigation: ProfileScreenNavProp;
}) {
  const { user, subscription, refreshSubscription, logout } = useAuth();
  const [isCanceling, setIsCanceling] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Reconcile with Stripe's actual state whenever this screen opens
    SubscriptionService.syncSubscriptionStatus().then(result => {
      if (result.changed) {
        refreshSubscription(user); // pull the corrected row into AuthContext
      }
    });
  }, []);

  const handleCancelSubscription = () => {
    if (Platform.OS === 'ios') {
      // Apple IAP cancellations happen through the App Store / Settings
      // app, not in-app — Apple doesn't allow apps to cancel IAP
      // subscriptions programmatically. Point the user there instead.
      Alert.alert(
        'Manage Subscription',
        'To cancel your subscription, go to Settings → Apple ID → Subscriptions on your device.',
      );
      return;
    }

    // Confirm before doing anything destructive
    Alert.alert(
      'Cancel Subscription',
      subscription?.currentPeriodEnd
        ? `You'll keep access until ${new Date(
            subscription.currentPeriodEnd,
          ).toLocaleDateString()}. You won't be charged again after that.`
        : "You'll keep access until the end of your current billing period. You won't be charged again after that.",
      [
        { text: 'Keep Subscription', style: 'cancel' },
        {
          text: 'Cancel Subscription',
          style: 'destructive',
          onPress: confirmCancelSubscription,
        },
      ],
    );
  };

  const confirmCancelSubscription = async () => {
    try {
      setIsCanceling(true);

      const result = await SubscriptionService.cancelSubscription();

      if (!result.success) {
        Alert.alert(
          'Unable to Cancel',
          result.error ?? 'Something went wrong. Please try again.',
        );
        return;
      }

      const syncResult = await SubscriptionService.syncSubscriptionStatus();
      if (syncResult.changed) {
        await refreshSubscription(user);
      }

      if (
        subscription?.status === 'canceled' ||
        syncResult.status === 'canceled'
      ) {
        Alert.alert(
          'Already Cancelled',
          'Your subscription has already been cancelled.',
        );
        return;
      }
      Alert.alert(
        'Subscription Cancelled',
        result.currentPeriodEnd
          ? `You'll keep access until ${new Date(
              result.currentPeriodEnd,
            ).toLocaleDateString()}.`
          : "You'll keep access until the end of your current billing period.",
      );
    } catch (err: any) {
      Alert.alert(
        'Unable to Cancel',
        err.message ?? 'Something went wrong. Please try again.',
      );
    } finally {
      setIsCanceling(false);
    }
  };

  return (
    <MainLayout
      title="Profile"
      subtitle="Your preferences"
      onBack={() => navigation.navigate('Home')}
    >
      <ProfileScreen
        onLogout={async () => {
          await logout();
          navigation.navigate('Auth', { initialMode: 'login' });
        }}
        handleCancelSubscription={() => {
          handleCancelSubscription();
        }}
        isCancelingSubscription={isCanceling}
      />
    </MainLayout>
  );
}

export function MainTabNavigator() {
  return (
    <Tab.Navigator
      tabBar={props => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Home" component={HomeTabScreen} />
      <Tab.Screen name="Travel" component={TravelTabScreen} />
      <Tab.Screen name="Dining" component={DiningTabScreen} />
      <Tab.Screen name="Inbox" component={InboxTabScreen} />
      <Tab.Screen name="Profile" component={ProfileTabScreen} />
    </Tab.Navigator>
  );
}
