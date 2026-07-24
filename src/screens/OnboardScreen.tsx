import React from 'react';
import { View, ScrollView, Text, Pressable } from 'react-native';
import styles from '../styles/styles';
import { PrimaryButton, GhostButtonSmall } from '../components';

interface OnboardScreenProps {
  onContinue: () => void;
}

export function OnboardScreen({ onContinue }: OnboardScreenProps) {
  return (
    <ScrollView contentContainerStyle={styles.screenContentScroll} showsVerticalScrollIndicator={false}>
      <View style={styles.onboardHeader}>
        <Text style={styles.eyebrow}>01 · Connect your accounts</Text>
        <Text style={styles.h2}>Atlas works best connected</Text>
        <Text style={styles.descriptionText}>These power your booking, dining, and inbox workflows.</Text>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Required connections</Text>
      </View>

      <View style={styles.connectionCard}>
        <View style={[styles.iconWrap, styles.navyTint]}>
          <Text style={styles.iconText}>📧</Text>
        </View>
        <View style={styles.moduleBodyExpanded}>
          <Text style={styles.rowTitle}>Email & calendar</Text>
          <Text style={styles.rowSub}>via Nylas</Text>
        </View>
        <GhostButtonSmall text="Connect" />
      </View>

      <View style={styles.connectionCard}>
        <View style={[styles.iconWrap, styles.goldTint]}>
          <Text style={styles.iconText}>🎙️</Text>
        </View>
        <View style={styles.moduleBodyExpanded}>
          <Text style={styles.rowTitle}>Voice dictation</Text>
          <Text style={styles.rowSub}>Microphone access for Deepgram</Text>
        </View>
        <GhostButtonSmall text="Allow" />
      </View>

      <PrimaryButton text="Enter Atlas →" onPress={onContinue} fullWidth />
    </ScrollView>
  );
}
