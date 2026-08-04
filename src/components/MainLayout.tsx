import React from 'react';
import { View, ScrollView, Pressable, Text, Alert } from 'react-native';
import styles, { colors } from '../styles/styles';
import { TabKey } from '../types';
import { useAuth } from '../context/AuthContext';

const tabItems = [
  { key: 'home' as TabKey, icon: '⌂', label: 'Home' },
  { key: 'travel' as TabKey, icon: '✈️', label: 'Travel' },
  { key: 'dining' as TabKey, icon: '🍽️', label: 'Dining' },
  { key: 'inbox' as TabKey, icon: '📧', label: 'Inbox' },
  { key: 'profile' as TabKey, icon: '👤', label: 'Profile' },
];

interface MainLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  onBack: () => void;
  activeTab: TabKey;
  onTabPress: (tab: TabKey) => void;
}

export function MainLayout({
  children,
  title,
  subtitle,
  onBack,
  activeTab,
  onTabPress,
}: MainLayoutProps) {
  const handleLogout = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out of Atlas?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: onBack },
    ]);
  };

  const { user } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.dashboardHeader}>
        <View>
          <Text style={styles.eyebrow}>{subtitle}</Text>
          <Text style={styles.title}>{title}</Text>
        </View>
        <View style={styles.headerRight}>
          {/* Logout button */}
          <Pressable style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutIcon}>⎋</Text>
          </Pressable>
          {/* Avatar */}
          <Pressable
            style={styles.avatar}
            onPress={() => onTabPress('profile')}
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

      <View style={styles.tabBar}>
        {tabItems.map(tab => (
          <Pressable
            key={tab.key}
            style={[
              styles.tab,
              activeTab === tab.key ? styles.activeTab : null,
            ]}
            onPress={() => onTabPress(tab.key)}
          >
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text
              style={[
                styles.tabLabel,
                activeTab === tab.key ? styles.activeTabLabel : null,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
