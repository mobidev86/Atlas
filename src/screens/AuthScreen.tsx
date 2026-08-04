import React, { useState } from 'react';
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Text,
  Alert,
} from 'react-native';
import styles from '../styles/styles';
import { InputField, PrimaryButton, LinkText } from '../components';
import { AuthMode } from '../types';
import { useAuth } from '../context/AuthContext';

interface AuthScreenProps {
  authMode: AuthMode;
  onSwitchMode: () => void;
  onSubmit: (success: boolean) => void;
}

export function AuthScreen({
  authMode,
  onSwitchMode,
  onSubmit,
}: AuthScreenProps) {
  const { login, register } = useAuth();
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    setErrorMessage(null);
    if (authMode === 'login') {
      const { success, error } = await login(email, password);
      console.log('Login result:', { success, error }); // Debugging log
      if (success) {
        onSubmit(true);
      } else {
        setErrorMessage(error || 'Login failed.');
      }
    } else {
      const { success, error } = await register(email, password, fullName);
      if (success) {
        onSubmit(true);
      } else {
        setErrorMessage(error || 'Registration failed.');
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.authScreen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.authScroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandWrap}>
          <View style={styles.brandBadge}>
            <Text style={styles.brandBadgeText}>A</Text>
          </View>
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

          {errorMessage && (
            <View
              style={{
                backgroundColor: '#FEE2E2',
                padding: 10,
                borderRadius: 8,
                marginBottom: 12,
              }}
            >
              <Text style={{ color: '#EF4444', fontSize: 13 }}>
                {errorMessage}
              </Text>
            </View>
          )}

          {authMode === 'register' && (
            <InputField
              placeholder="Full name"
              focusedInput={focusedInput}
              inputKey="name"
              value={fullName}
              onChangeText={setFullName}
              onFocus={setFocusedInput}
              onBlur={() => setFocusedInput(null)}
            />
          )}

          <InputField
            placeholder="Email address"
            focusedInput={focusedInput}
            inputKey="email"
            value={email}
            onChangeText={setEmail}
            onFocus={setFocusedInput}
            onBlur={() => setFocusedInput(null)}
            keyboardType="email-address"
          />

          <InputField
            placeholder="Password"
            focusedInput={focusedInput}
            inputKey="password"
            value={password}
            onChangeText={(text: string) => setPassword(text)}
            onFocus={setFocusedInput}
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
