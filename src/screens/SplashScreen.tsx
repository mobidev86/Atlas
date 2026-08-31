import React, { useRef, useState } from 'react';
import {
  View,
  Pressable,
  Text,
  ScrollView,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Image,
} from 'react-native';
import styles from '../styles/styles';
import { PrimaryButton, LinkText } from '../components';
import logo from '../assets/images/ic_logo.png';

const { width } = Dimensions.get('window');

interface SplashScreenProps {
  onStart: () => void;
  onSkip: () => void;
}

const slides = [
  {
    title: 'Atlas',
    subtitle:
      'Book travel, find a table, and clear your inbox — with a word, not a form.',
    icon: 'A',
  },
  {
    title: 'Travel',
    subtitle:
      'Find flights, hotels, and experiences. All through natural conversation.',
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
  const scrollRef = useRef<ScrollView>(null);

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
    setActiveSlide(index);
  };

  return (
    <View style={styles.splashRoot}>
      {/* Slides — manual dot-driven, no ScrollView flex waste */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
      >
        {slides.map((slide, index) => (
          <View
            key={index}
            style={[
              styles.splashSlide,
              {
                width,
              },
            ]}
          >
            {index === 0 ? (
              <Image
                source={logo}
                style={styles.brandLogo}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.brandBadgeLarge}>
                <Text style={styles.brandBadgeTextLarge}>{slide.icon}</Text>
              </View>
            )}

            <Text style={styles.brandTitleLarge}>{slide.title}</Text>

            <Text style={styles.brandSubtitleLarge}>{slide.subtitle}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Dot navigation */}
      <View style={styles.dotRow}>
        {slides.map((_, index) => (
          <Pressable
            key={index}
            onPress={() => {
              setActiveSlide(index);

              scrollRef.current?.scrollTo({
                x: index * width,
                animated: true,
              });
            }}
          >
            <View
              style={[styles.dot, activeSlide === index && styles.dotActive]}
            />
          </Pressable>
        ))}
      </View>

      {/* CTAs pinned at bottom */}
      <View style={styles.splashActions}>
        <PrimaryButton text="Get started →" onPress={onStart} large />
        {/* <LinkText text="Skip to demo" onPress={onSkip} variant="primary" /> */}
      </View>
    </View>
  );
}
