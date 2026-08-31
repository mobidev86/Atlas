import React, { useRef, useState } from 'react';
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Text,
  Image,
} from 'react-native';
import styles from '../styles/styles';
import { InputField, PrimaryButton, LinkText } from '../components';
import { AuthMode } from '../types';
import { useAuth } from '../context/AuthContext';
import { MessageToast } from '../services/messageToast';

import logo from '../assets/images/ic_logo.png';

interface AuthScreenProps {
  authMode: AuthMode;
  onSwitchMode: () => void;
}

export function AuthScreen({ authMode, onSwitchMode }: AuthScreenProps) {
  const { login, register } = useAuth();

  const scrollViewRef = useRef<ScrollView>(null);

  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  const handleInputFocus = (inputKey: string) => {
    setFocusedInput(inputKey);

    // Give the keyboard a moment to appear,
    // then move the form upward.
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({
        animated: true,
      });
    }, 250);
  };

  const handleSubmit = async () => {
    if (authMode === 'login') {
      const { success, error } = await login(email, password);

      if (!success) {
        MessageToast.error(error || 'Login failed.');
      }
    } else {
      const { success, error } = await register(email, password, fullName);

      if (!success) {
        MessageToast.error(error || 'Registration failed.');
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.authScreen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={[
          styles.authScroll,
          {
            flexGrow: 1,
            paddingBottom: 70,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        <View style={styles.brandWrap}>
          <Image source={logo} style={styles.brandLogo} resizeMode="contain" />

          <Text style={styles.brandTitle}>Atlas</Text>

          <Text style={styles.brandSubtitleAuth}>
            Sign in or create your account to continue your day with calm
            control.
          </Text>
        </View>

        <View style={styles.cardAuth}>
          <Text style={styles.cardEyebrow}>
            {authMode === 'login' ? 'Welcome back' : 'Create your account'}
          </Text>

          <Text style={styles.cardTitle}>
            {authMode === 'login'
              ? 'Sign in to continue your day'
              : 'Start with a cleaner way to travel'}
          </Text>

          {authMode === 'register' && (
            <InputField
              placeholder="Full name"
              focusedInput={focusedInput}
              inputKey="name"
              value={fullName}
              onChangeText={setFullName}
              onFocus={() => handleInputFocus('name')}
              onBlur={() => setFocusedInput(null)}
            />
          )}

          <InputField
            placeholder="Email address"
            focusedInput={focusedInput}
            inputKey="email"
            value={email}
            onChangeText={setEmail}
            onFocus={() => handleInputFocus('email')}
            onBlur={() => setFocusedInput(null)}
            keyboardType="email-address"
          />

          <InputField
            placeholder="Password"
            focusedInput={focusedInput}
            inputKey="password"
            value={password}
            onChangeText={setPassword}
            onFocus={() => handleInputFocus('password')}
            onBlur={() => setFocusedInput(null)}
            secureTextEntry
          />

          <PrimaryButton
            text={authMode === 'login' ? 'Log in' : 'Create account'}
            onPress={handleSubmit}
            fullWidth
          />

          <LinkText
            text={
              authMode === 'login'
                ? 'Need an account? Create one'
                : 'Already have an account? Sign in'
            }
            onPress={onSwitchMode}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
