import React from 'react';
import { View, ActivityIndicator, StyleSheet, ColorValue } from 'react-native';

interface LoadingOverlayProps {
  visible?: boolean;
  color?: ColorValue;
  size?: 'small' | 'large';
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  visible = true,
  color = '#fff',
  size = 'large',
}) => {
  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.spinnerCard}>
        <ActivityIndicator size={size} color={color} />
      </View>
    </View>
  );
};

export default LoadingOverlay;

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  spinnerCard: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: 20,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
