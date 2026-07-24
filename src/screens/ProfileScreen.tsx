import React from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import styles from '../styles/styles';
import { useAuth } from '../context/AuthContext';

interface ProfileScreenProps {
  onLogout?: () => void;
}

export function ProfileScreen({ onLogout }: ProfileScreenProps) {
  const { user, toggleAutoBook, toggleZeroRetention, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    if (onLogout) onLogout();
  };

  const zeroRetention = user?.zeroRetentionEnabled ?? true;
  const autoBook = user?.autoBookEnabled ?? false;
  const nylasStatus = user?.nylasAccountStatus || 'connected';
  const lastSynced = user?.lastEmailSyncedAt ? 'synced 1m ago' : 'synced recently';

  return (
    <View>
      {/* Preferences */}
      <View style={styles.card}>
        <View style={styles.row}>
          <View>
            <Text style={styles.rowTitle}>Connected email</Text>
            <Text style={styles.rowSub}>Nylas · {nylasStatus} ({lastSynced})</Text>
          </View>
          <Text style={styles.rowIcon}>›</Text>
        </View>
        <View style={styles.row}>
          <View>
            <Text style={styles.rowTitle}>Travel preferences</Text>
            <Text style={styles.rowSub}>
              {user?.travelPreferences?.seatType || 'Aisle'} seat · {user?.travelPreferences?.minHotelRating || 4}-star min
            </Text>
          </View>
          <Text style={styles.rowIcon}>›</Text>
        </View>
        <View style={styles.row}>
          <View>
            <Text style={styles.rowTitle}>Dining preferences</Text>
            <Text style={styles.rowSub}>
              {user?.diningPreferences?.ambiance || 'Quiet'} · {user?.diningPreferences?.dietaryRestrictions?.join(', ') || 'no shellfish'}
            </Text>
          </View>
          <Text style={styles.rowIcon}>›</Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Privacy & Automation</Text>
      </View>

      <View style={styles.card}>
        {/* Zero-retention mode — pressable pill toggle */}
        <Pressable
          style={styles.row}
          onPress={toggleZeroRetention}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Zero-retention mode</Text>
            <Text style={styles.rowSub}>
              No data kept by model providers · enforced on every request
            </Text>
          </View>
          <View
            style={[
              styles.pill,
              zeroRetention
                ? styles.pillActive
                : styles.pillOff,
            ]}>
            <Text
              style={[
                styles.pillText,
                !zeroRetention && styles.pillTextOff,
              ]}>
              {zeroRetention ? 'Always on' : 'Off'}
            </Text>
          </View>
        </Pressable>

        {/* Auto-book on confirm — real toggle switch */}
        <Pressable
          style={[styles.row, { borderBottomWidth: 0 }]}
          onPress={toggleAutoBook}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Auto-book on confirm</Text>
            <Text style={styles.rowSub}>Execute booking without a second tap</Text>
          </View>
          <View style={[styles.toggleTrack, autoBook && styles.toggleTrackOn]}>
            <View style={[styles.toggleThumb, autoBook && styles.toggleThumbOn]} />
          </View>
        </Pressable>
      </View>

      <View style={{ marginTop: 24 }}>
        <Pressable
          style={{
            backgroundColor: '#FEE2E2',
            paddingVertical: 14,
            borderRadius: 12,
            alignItems: 'center',
          }}
          onPress={handleLogout}>
          <Text style={{ color: '#EF4444', fontWeight: '600', fontSize: 15 }}>Sign out</Text>
        </Pressable>
      </View>
    </View>
  );
}
