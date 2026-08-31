import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

interface AudioWaveformProps {
  volume: number;
  isRecording: boolean;
}

/**
 * Number of waveform bars.
 */
const BAR_COUNT = 25;

/**
 * Minimum visible bar height.
 */
const MIN_HEIGHT = 3;

/**
 * Maximum bar height.
 *
 * This should stay within the height of the
 * waveform area on TravelScreen.
 */
const MAX_HEIGHT = 54;

/**
 * Visual amplification.
 *
 * If the microphone is producing relatively
 * small normalized volume values, this makes
 * the waveform react more strongly.
 */
const VOLUME_AMPLIFICATION = 2.5;

/**
 * Prevent the waveform from becoming completely
 * flat during quiet speech/background noise.
 */
const MIN_VOLUME_THRESHOLD = 0.02;

const AudioWaveform = ({ volume, isRecording }: AudioWaveformProps) => {
  const animatedVolume = useRef(new Animated.Value(0)).current;

  /**
   * -----------------------------------------
   * Normalize + amplify volume
   * -----------------------------------------
   */
  useEffect(() => {
    let normalizedVolume = 0;

    if (isRecording) {
      /**
       * Make sure we never work with negative
       * or invalid values.
       */
      const safeVolume = Number.isFinite(volume) ? Math.max(0, volume) : 0;

      /**
       * Ignore extremely small values so the
       * waveform doesn't constantly twitch.
       */
      if (safeVolume > MIN_VOLUME_THRESHOLD) {
        /**
         * Amplify the microphone input visually.
         */
        normalizedVolume = safeVolume * VOLUME_AMPLIFICATION;
      }

      /**
       * Keep the value within 0–1.
       */
      normalizedVolume = Math.min(Math.max(normalizedVolume, 0), 1);
    }

    Animated.timing(animatedVolume, {
      toValue: normalizedVolume,
      duration: 50,
      useNativeDriver: false,
    }).start();
  }, [volume, isRecording, animatedVolume]);

  return (
    <View style={styles.container}>
      {Array.from({ length: BAR_COUNT }).map((_, index) => {
        /**
         * -----------------------------------
         * Center weighting
         * -----------------------------------
         *
         * Bars near the center are taller.
         * Bars toward the edges are shorter.
         */
        const distanceFromCenter =
          Math.abs(index - (BAR_COUNT - 1) / 2) / ((BAR_COUNT - 1) / 2);

        /**
         * Center bars get 100% of the volume.
         * Edge bars get approximately 50%.
         */
        const centerFactor = 1 - distanceFromCenter * 0.5;

        /**
         * Slightly vary each bar so the waveform
         * doesn't look like a perfectly symmetrical
         * static shape.
         */
        const variation = 0.9 + ((index * 7) % 5) * 0.025;

        const effectiveFactor = Math.min(centerFactor * variation, 1);

        /**
         * -----------------------------------
         * Animated height
         * -----------------------------------
         */
        const height = animatedVolume.interpolate({
          inputRange: [0, 1],
          outputRange: [
            MIN_HEIGHT,
            MIN_HEIGHT + (MAX_HEIGHT - MIN_HEIGHT) * effectiveFactor,
          ],
          extrapolate: 'clamp',
        });

        return (
          <Animated.View
            key={index}
            style={[
              styles.bar,
              {
                height,
              },
            ]}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 56,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

    overflow: 'hidden',
  },

  bar: {
    width: 3,

    marginHorizontal: 2,

    borderRadius: 10,

    backgroundColor: '#233A5E',
  },
});

export default AudioWaveform;
