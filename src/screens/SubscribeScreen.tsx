import React, { useState } from 'react';
import { View, ScrollView, Text, Pressable } from 'react-native';
import styles from '../styles/styles';
import { PrimaryButton } from '../components';
import { useAuth } from '../context/AuthContext';

interface SubscribeScreenProps {
  onSubscribe: () => void;
  onBack: () => void;
}

const FEATURES = [
  { icon: '✈️', label: 'Travel & hotel bookings', sub: 'Flights, stays, and itinerary coordination' },
  { icon: '🍽️', label: 'Dining reservations', sub: 'Discover and reserve the perfect table' },
  { icon: '📧', label: 'Inbox & smart replies', sub: 'AI-drafted replies to priority mail' },
  { icon: '🗓️', label: 'Daily task planning', sub: 'Auto-organised to-do list every morning' },
  { icon: '🎙️', label: 'Voice dictation', sub: 'Hands-free via Whisper integration' },
];

export function SubscribeScreen({ onSubscribe, onBack }: SubscribeScreenProps) {
  const { subscribe } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    const { success } = await subscribe();
    setLoading(false);
    if (success) {
      onSubscribe();
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.subscribeScroll} showsVerticalScrollIndicator={false}>
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
            <Text style={styles.subscribePriceBilled}>Billed monthly · Cancel anytime</Text>
          </View>
        </View>
        <View style={styles.subscribeDivider} />
        <Text style={styles.subscribeFeaturesLabel}>Everything included</Text>
        {FEATURES.map((f, i) => (
          <View key={i} style={styles.subscribeFeatureRow}>
            <View style={[styles.subscribeFeatureIcon, styles.navyTint]}>
              <Text style={styles.iconText}>{f.icon}</Text>
            </View>
            <View style={styles.subscribeFeatureBody}>
              <Text style={styles.subscribeFeatureTitle}>{f.label}</Text>
              <Text style={styles.subscribeFeatureSub}>{f.sub}</Text>
            </View>
            <Text style={styles.subscribeCheckmark}>✓</Text>
          </View>
        ))}
      </View>

      {/* Guarantee */}
      <View style={styles.subscribeGuaranteeCard}>
        <Text style={styles.subscribeGuaranteeIcon}>🔒</Text>
        <View style={styles.subscribeGuaranteeBody}>
          <Text style={styles.subscribeGuaranteeTitle}>Risk-free guarantee</Text>
          <Text style={styles.subscribeGuaranteeSub}>
            Try Atlas free for 7 days. No charge until your trial ends.
          </Text>
        </View>
      </View>

      {/* CTA */}
      <PrimaryButton
        text={loading ? 'Processing subscription...' : 'Start 7-day free trial  →'}
        onPress={handleSubscribe}
        fullWidth
      />

      <Pressable onPress={onBack} style={styles.subscribeBackLink}>
        <Text style={styles.subscribeBackText}>← Back to sign in</Text>
      </Pressable>

      <Text style={styles.subscribeLegal}>
        By continuing you agree to our Terms of Service and Privacy Policy.
        Subscription renews at $10/month unless cancelled.
      </Text>
    </ScrollView>
  );
}
