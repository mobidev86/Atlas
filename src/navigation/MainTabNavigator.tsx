import React from 'react';
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
  const { logout } = useAuth();

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
