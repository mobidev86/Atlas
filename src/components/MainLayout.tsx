import React from 'react';
import { View, ScrollView, Pressable, Text, Alert } from 'react-native';
import styles from '../styles/styles';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainTabParamList, RootStackParamList } from '../types/navigation';

type MainLayoutNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

interface MainLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  onBack?: () => void;
}

export function MainLayout({
  children,
  title,
  subtitle,
  onBack,
}: MainLayoutProps) {
  const { user, logout } = useAuth();
  const navigation = useNavigation<MainLayoutNavigationProp>();

  const handleLogout = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out of Atlas?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          if (onBack) {
            onBack();
          } else {
            await logout();
            navigation.navigate('Auth', { initialMode: 'login' });
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.dashboardHeader}>
        <View>
          <Text style={styles.eyebrow}>{subtitle}</Text>
          <Text style={styles.title}>{title}</Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutIcon}>⎋</Text>
          </Pressable>
          <Pressable
            style={styles.avatar}
            onPress={() => navigation.navigate('Profile')}
          >
            <Text style={styles.avatarText}>
              {user?.fullName?.charAt(0).toUpperCase() ?? '-'}
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  );
}
