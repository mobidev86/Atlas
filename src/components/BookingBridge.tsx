import React, { useEffect } from 'react';
import { Modal, View, Text, ActivityIndicator, StyleSheet } from 'react-native';

interface BookingBridgeProps {
  visible: boolean;
  title: string;
  onComplete: () => void;
  durationMs?: number;
}

export function BookingBridge({
  visible,
  title,
  onComplete,
  durationMs = 3000,
}: BookingBridgeProps) {
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(onComplete, durationMs);
    return () => clearTimeout(timer);
  }, [visible, onComplete, durationMs]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={bridgeStyles.overlay}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={bridgeStyles.title}>Processing your booking</Text>
        <Text style={bridgeStyles.subtitle} numberOfLines={2}>
          {title}
        </Text>
      </View>
    </Modal>
  );
}

const bridgeStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  subtitle: {
    color: '#8A95A6',
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
