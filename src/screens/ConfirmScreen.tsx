import React from 'react';
import { View, Text } from 'react-native';
import styles from '../styles/styles';
import { ConfirmationState } from '../types';

interface ConfirmScreenProps {
  confirmation: ConfirmationState;
}

export function ConfirmScreen({ confirmation }: ConfirmScreenProps) {
  return (
    <View style={styles.confirmWrap}>
      <View style={styles.checkBadge}>
        <Text style={styles.checkText}>✓</Text>
      </View>
      <Text style={styles.h2}>Confirmed</Text>
      <Text style={styles.mutedText}>{confirmation.subtitle}</Text>

      <View style={styles.receiptCard}>
        <View style={styles.receiptRow}>
          <Text style={styles.receiptLabel}>Item</Text>
          <Text style={styles.receiptValue}>{confirmation.item}</Text>
        </View>
        <View style={styles.receiptRow}>
          <Text style={styles.receiptLabel}>Provider</Text>
          <Text style={styles.receiptValue}>{confirmation.provider}</Text>
        </View>
        <View style={styles.receiptRow}>
          <Text style={styles.receiptLabel}>Price</Text>
          <Text style={styles.receiptValue}>{confirmation.price}</Text>
        </View>
      </View>
    </View>
  );
}
