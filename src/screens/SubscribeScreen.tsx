import React from 'react';
import {
  View,
  ScrollView,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import type { IoniconsIconName } from '@react-native-vector-icons/ionicons';
import styles, { colors } from '../styles/styles';
import { PrimaryButton } from '../components';

interface SubscribeScreenProps {
  onSubscribe: (tier?: 'standard' | 'executive') => void;
  onBack: () => void;
  isProcessing: boolean;
  error: string | null;
  isTrialEligible: boolean;
}

const FEATURES: { icon: IoniconsIconName; label: string; sub: string }[] = [
  {
    icon: 'airplane-outline',
    label: 'Travel & hotel bookings',
    sub: 'Flights, stays, and itinerary coordination',
  },
  {
    icon: 'restaurant-outline',
    label: 'Dining reservations',
    sub: 'Discover and reserve the perfect table',
  },
  {
    icon: 'mail-outline',
    label: 'Inbox & smart replies',
    sub: 'AI-drafted replies to priority mail',
  },
  {
    icon: 'calendar-outline',
    label: 'Daily task planning',
    sub: 'Auto-organised to-do list every morning',
  },
  {
    icon: 'mic-outline',
    label: 'Voice dictation',
    sub: 'Hands-free via Whisper integration',
  },
];

export function SubscribeScreen({
  onSubscribe,
  onBack,
  isProcessing,
  error,
  isTrialEligible,
}: SubscribeScreenProps) {
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={styles.subscribeScroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.subscribeBrandWrap}>
          <View style={styles.brandBadge}>
            <Text style={styles.brandBadgeText}>A</Text>
          </View>
          <Text style={styles.subscribeTitle}>Unlock Atlas Pro</Text>
          <Text style={styles.subscribeSubtitle}>
            One plan. Every feature. Calm control over your day.
          </Text>
        </View>

        {/* Price Card */}
        <View style={styles.subscribePriceCard}>
          <View style={styles.subscribePriceBadge}>
            <Text style={styles.subscribePriceBadgeText}>MOST POPULAR</Text>
          </View>
          <View style={styles.subscribePriceRow}>
            <Text style={styles.subscribePriceAmount}>$10</Text>
            <View style={styles.subscribePriceMeta}>
              <Text style={styles.subscribePricePer}>/month</Text>
              <Text style={styles.subscribePriceBilled}>
                Billed monthly · Cancel anytime
              </Text>
            </View>
          </View>
          <View style={styles.subscribeDivider} />
          <Text style={styles.subscribeFeaturesLabel}>Everything included</Text>
          {FEATURES.map((f, i) => (
            <View key={i} style={styles.subscribeFeatureRow}>
              <View style={[styles.subscribeFeatureIcon, styles.navyTint]}>
                <Ionicons name={f.icon} size={18} color={colors.navy} />
              </View>
              <View style={styles.subscribeFeatureBody}>
                <Text style={styles.subscribeFeatureTitle}>{f.label}</Text>
                <Text style={styles.subscribeFeatureSub}>{f.sub}</Text>
              </View>
              <Ionicons name="checkmark-circle" size={18} color={colors.navy} />
            </View>
          ))}
        </View>

        {/* Guarantee */}
        <View style={styles.subscribeGuaranteeCard}>
          <Ionicons
            name="lock-closed-outline"
            size={24}
            color={colors.rustBrown}
            style={{ marginRight: 12 }}
          />
          <View style={styles.subscribeGuaranteeBody}>
            <Text style={styles.subscribeGuaranteeTitle}>
              {isTrialEligible ? 'Risk-free guarantee' : 'Atlas Pro'}
            </Text>
            <Text style={styles.subscribeGuaranteeSub}>
              {isTrialEligible
                ? 'Try Atlas free for 7 days. No charge until your trial ends.'
                : "You've already used your free trial. You'll be charged today when you subscribe."}
            </Text>
          </View>
        </View>

        {/* Error message — sits right above the CTA so it's the last
            thing the user reads before retrying */}
        {error && (
          <View style={subscribeStyles.errorBanner}>
            <Ionicons
              name="alert-circle-outline"
              size={18}
              color={colors.errorRed ?? '#B91C1C'}
              style={{ marginRight: 8 }}
            />
            <Text style={subscribeStyles.errorText}>{error}</Text>
          </View>
        )}

        {/* CTA */}
        <PrimaryButton
          text={
            isProcessing
              ? 'Processing subscription...'
              : isTrialEligible
              ? 'Start 7-day free trial  →'
              : 'Subscribe now  →'
          }
          onPress={() => onSubscribe('executive')}
          fullWidth
          disabled={isProcessing}
        />

        <Pressable
          onPress={onBack}
          style={styles.subscribeBackLink}
          disabled={isProcessing}
        >
          <Text style={styles.subscribeBackText}>← Back to sign in</Text>
        </Pressable>

        <Text style={styles.subscribeLegal}>
          By continuing you agree to our Terms of Service and Privacy Policy.
          Subscription renews at $10/month unless cancelled.
        </Text>
      </ScrollView>

      {/* Same overlay pattern as AppNavigator — blocks taps while a
          request is in flight (e.g. createTrialSetup, before PaymentSheet
          even opens) and while confirmTrialSubscription runs after it */}
      {isProcessing && (
        <View
          style={{
            ...StyleSheet.absoluteFill,
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
          }}
        >
          <View style={subscribeStyles.spinnerCard}>
            <ActivityIndicator size="large" color={colors.navy} />
          </View>
        </View>
      )}
    </View>
  );
}

const subscribeStyles = {
  errorBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    flex: 1,
    color: '#B91C1C',
    fontSize: 13,
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
};
