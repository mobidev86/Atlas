import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  TouchableOpacity,
  Image,
} from 'react-native';
import styles from '../styles/styles';
import Ionicons from '@react-native-vector-icons/ionicons';

import EYE_OPEN_ICON from '../assets/images/ic_hide_pass.png';
import EYE_CLOSED_ICON from '../assets/images/ic_show_pass.png';

// Badge Component
interface BadgeProps {
  text: string;
}

export function Badge({ text }: BadgeProps) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{text}</Text>
    </View>
  );
}

// Badge Row Component (multiple badges)
interface BadgeRowProps {
  badges: string[];
}

export function BadgeRow({ badges }: BadgeRowProps) {
  return (
    <View style={styles.badgeRow}>
      {badges.map((badge, index) => (
        <Badge key={index} text={badge} />
      ))}
    </View>
  );
}

// Result Card Component (for Travel & Dining screens)
interface ResultCardProps {
  title: string;
  meta: string;
  price: string;
  badges: string[];
  reason?: string;
  onPress?: () => void;
  onViewMap?: () => void;
}

export function ResultCard({
  title,
  meta,
  price,
  badges,
  reason,
  onPress,
  onViewMap,
}: ResultCardProps) {
  return (
    <Pressable style={styles.resultCardEnhanced} onPress={onPress}>
      <View style={styles.resultCardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.resultTitle}>{title}</Text>

          <Text style={styles.resultMeta}>{meta}</Text>
        </View>

        {!!price && <Text style={styles.resultPrice}>{price}</Text>}
      </View>

      {!!reason && (
        <View style={styles.reasonContainer}>
          <View style={styles.reasonIconContainer}>
            <Ionicons name="sparkles" size={14} color="#7C5C00" />
          </View>

          <View style={styles.reasonContent}>
            <Text style={styles.reasonLabel}>Why we recommend it</Text>

            <Text style={styles.reasonText}>{reason}</Text>
          </View>
        </View>
      )}

      <View style={styles.resultCardBottom}>
        <View style={styles.badgeContainer}>
          <BadgeRow badges={badges} />
        </View>

        {onViewMap && (
          <Pressable
            style={styles.resultMapButton}
            onPress={event => {
              event.stopPropagation();
              onViewMap();
            }}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`View ${title} on map`}
          >
            <Ionicons name="location-outline" size={20} color="#1E293B" />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

// Inbox Card Component
interface InboxCardProps {
  title: string;
  subtitle: string;
  message: string;
  isActive?: boolean;
  isPriority?: boolean;
  onPress?: () => void;
}

export function InboxCard({
  title,
  subtitle,
  message,
  isActive = false,
  isPriority = false,
  onPress,
}: InboxCardProps) {
  if (isActive) {
    return (
      <Pressable style={styles.inboxCardActive} onPress={onPress}>
        <View style={styles.inboxCardLeft}>
          <Text style={styles.inboxTitle}>{title}</Text>
          <Text style={styles.inboxTitleSub}>{subtitle}</Text>
          <Text style={styles.inboxText}>{message}</Text>
        </View>
        {isPriority && (
          <View style={styles.priorityBadge}>
            <Text style={styles.priorityBadgeText}>!</Text>
          </View>
        )}
      </Pressable>
    );
  }

  return (
    <View style={styles.inboxCardInactive}>
      <View style={styles.inboxCardLeft}>
        <Text style={styles.inboxTitle}>{title}</Text>
        <Text style={styles.inboxTitleSub}>{subtitle}</Text>
        <Text style={styles.inboxText}>{message}</Text>
      </View>
      <Text style={styles.inboxMutedIcon}>◦</Text>
    </View>
  );
}

// Input Field Component with Focus State
interface InputFieldProps {
  placeholder: string;
  focusedInput: string | null;
  inputKey: string;
  value: string;
  onChangeText: (text: string) => void;
  onFocus: (key: string) => void;
  onBlur: () => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
}

export function InputField({
  placeholder,
  focusedInput,
  inputKey,
  value,
  onChangeText,
  onFocus,
  onBlur,
  secureTextEntry = false,
  keyboardType = 'default',
  ...rest
}: InputFieldProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <View style={styles.wrapper}>
      <TextInput
        style={[
          styles.input,
          focusedInput === inputKey && styles.inputFocused,
          secureTextEntry && styles.inputWithToggle,
        ]}
        placeholder={placeholder}
        placeholderTextColor="#8A95A6"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry && !isVisible}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
        onFocus={() => onFocus(inputKey)}
        onBlur={onBlur}
        {...rest}
      />
      {secureTextEntry && (
        <TouchableOpacity
          style={styles.toggleButton}
          onPress={() => setIsVisible(prev => !prev)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
        >
          <Image
            source={isVisible ? EYE_OPEN_ICON : EYE_CLOSED_ICON}
            style={styles.toggleIcon}
            resizeMode="contain"
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

// Primary Button Component
interface PrimaryButtonProps {
  text: string;
  onPress: () => void;
  fullWidth?: boolean;
  large?: boolean;
  disabled?: boolean;
}

export function PrimaryButton({
  text,
  onPress,
  fullWidth = false,
  large = false,
  disabled = false,
}: PrimaryButtonProps) {
  const buttonStyle = fullWidth
    ? styles.primaryButtonFull
    : large
    ? [styles.primaryButton, styles.primaryButtonLarge]
    : styles.primaryButton;

  return (
    <Pressable style={buttonStyle} onPress={onPress} disabled={disabled}>
      <Text style={styles.primaryButtonText}>{text}</Text>
    </Pressable>
  );
}

// Secondary Button Component
interface SecondaryButtonProps {
  text: string;
  onPress: () => void;
}

export function SecondaryButton({ text, onPress }: SecondaryButtonProps) {
  return (
    <Pressable style={styles.secondaryButton} onPress={onPress}>
      <Text style={styles.secondaryButtonText}>{text}</Text>
    </Pressable>
  );
}

// Ghost Button Component (small)
interface GhostButtonSmallProps {
  text: string;
  onPress?: () => void;
}

export function GhostButtonSmall({ text, onPress }: GhostButtonSmallProps) {
  return (
    <Pressable style={styles.ghostButtonSmall} onPress={onPress}>
      <Text style={styles.ghostButtonTextSmall}>{text}</Text>
    </Pressable>
  );
}

// Link Text Component
interface LinkTextProps {
  text: string;
  onPress: () => void;
  variant?: 'primary' | 'auth';
}

export function LinkText({ text, onPress, variant = 'auth' }: LinkTextProps) {
  const linkStyle =
    variant === 'auth' ? styles.linkTextAuth : styles.linkTextPrimary;
  return (
    <Pressable onPress={onPress}>
      <Text style={linkStyle}>{text}</Text>
    </Pressable>
  );
}
