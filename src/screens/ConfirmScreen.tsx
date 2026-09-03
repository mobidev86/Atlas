import React from 'react';
import { View, Text } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';

import styles from '../styles/styles';
import { ConfirmationState } from '../types';
import { BookingCard, UserBooking } from '../components/BookingCard';

interface ConfirmScreenProps {
  confirmation: ConfirmationState;
  booking: UserBooking;
}

export function ConfirmScreen({ confirmation, booking }: ConfirmScreenProps) {
  return (
    <View style={styles.confirmWrap}>
      <View style={styles.checkBadge}>
        <Ionicons name="checkmark-sharp" size={28} color="#FFFFFF" />
      </View>
      <Text style={styles.h2}>Confirmed</Text>
      <Text style={styles.mutedText}>{confirmation.subtitle}</Text>
      <View style={{ width: '100%', marginTop: 20 }}>
        <BookingCard booking={booking} />
      </View>
    </View>
  );
}
