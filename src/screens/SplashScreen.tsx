import React, { useState } from 'react';
import { View, Pressable, Text } from 'react-native';
import styles from '../styles/styles';
import { PrimaryButton, LinkText } from '../components';

interface SplashScreenProps {
  onStart: () => void;
  onSkip: () => void;
}

const slides = [
  {
    title: 'Atlas',
    subtitle: 'Book travel, find a table, and clear your inbox — with a word, not a form.',
    icon: 'A',
  },
  {
    title: 'Travel',
    subtitle: 'Find flights, hotels, and experiences. All through natural conversation.',
    icon: '✈️',
  },
  {
    title: 'Dine',
    subtitle: 'Discover restaurants, make reservations. No typing required.',
    icon: '🍽️',
  },
];

export function SplashScreen({ onStart, onSkip }: SplashScreenProps) {
  const [activeSlide, setActiveSlide] = useState(0);

  return (
    <View style={styles.splashRoot}>
      {/* Slides — manual dot-driven, no ScrollView flex waste */}
      <View style={styles.splashSlide}>
        <View style={styles.brandBadgeLarge}>
          <Text style={styles.brandBadgeTextLarge}>{slides[activeSlide].icon}</Text>
        </View>
        <Text style={styles.brandTitleLarge}>{slides[activeSlide].title}</Text>
        <Text style={styles.brandSubtitleLarge}>{slides[activeSlide].subtitle}</Text>
      </View>

      {/* Dot navigation */}
      <View style={styles.dotRow}>
        {slides.map((_, index) => (
          <Pressable key={index} onPress={() => setActiveSlide(index)}>
            <View style={[styles.dot, activeSlide === index && styles.dotActive]} />
          </Pressable>
        ))}
      </View>

      {/* CTAs pinned at bottom */}
      <View style={styles.splashActions}>
        <PrimaryButton text="Get started →" onPress={onStart} large />
        <LinkText text="Skip to demo" onPress={onSkip} variant="primary" />
      </View>
    </View>
  );
}
