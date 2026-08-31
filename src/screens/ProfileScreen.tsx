import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Alert,
  ActivityIndicator,
  AppState,
  Modal,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import styles from '../styles/styles';
import { useAuth } from '../context/AuthContext';
import { InputField } from '../components';
import { GoogleAuthService } from '../services/googleAuthService';
import { ZoomAuthService } from '../services/zoomAuthService';
import { supabase } from '../services/supabase';
import { InAppWebView } from '../components/InAppWebview';

interface ProfileScreenProps {
  onLogout?: () => void;
  handleCancelSubscription: () => void;
  isCancelingSubscription: boolean;
  onChangePassword?: () => void;
  onSaveProfile?: (fullName: string) => void;
  onChangeProfilePicture?: () => void;
}

export function ProfileScreen({
  onLogout,
  handleCancelSubscription,
  isCancelingSubscription,
  onChangePassword,
  onSaveProfile,
  onChangeProfilePicture,
}: ProfileScreenProps) {
  const {
    user,
    toggleAutoBook,
    toggleZeroRetention,
    logout,
    subscription,
    refreshSubscription,
  } = useAuth();

  const insets = useSafeAreaInsets();

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  // Google OAuth
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [googleAuthUrl, setGoogleAuthUrl] = useState<string | null>(null);

  // Zoom OAuth
  const [isConnectingZoom, setIsConnectingZoom] = useState(false);
  const [isZoomConnected, setIsZoomConnected] = useState(false);
  const [zoomAuthUrl, setZoomAuthUrl] = useState<string | null>(null);

  const handleLogout = async () => {
    await logout();

    if (onLogout) {
      onLogout();
    }
  };

  const handleChangePassword = () => {
    if (onChangePassword) {
      onChangePassword();
    } else {
      Alert.alert(
        'Change Password',
        'Change password flow not yet implemented.',
      );
    }
  };

  const handleSaveProfile = () => {
    if (onSaveProfile) {
      onSaveProfile(fullName);
    } else {
      Alert.alert('Save Profile', 'Save profile flow not yet implemented.');
    }
  };

  const handleProfilePicturePress = () => {
    if (onChangeProfilePicture) {
      onChangeProfilePicture();
    } else {
      Alert.alert(
        'Profile Picture',
        'Choose picture flow not yet implemented.',
      );
    }
  };

  // ---------------------------------------------------------
  // Google connection check
  // ---------------------------------------------------------

  const checkGoogleConnection = async () => {
    if (!user?.id) {
      setIsGoogleConnected(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('google_integrations')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.log('CHECK GOOGLE CONNECTION ERROR:', error);
        return;
      }

      setIsGoogleConnected(!!data);
    } catch (error) {
      console.log('CHECK GOOGLE CONNECTION ERROR:', error);
    }
  };

  // ---------------------------------------------------------
  // Zoom connection check
  // ---------------------------------------------------------

  const checkZoomConnection = async () => {
    if (!user?.id) {
      setIsZoomConnected(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('zoom_integrations')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.log('CHECK ZOOM CONNECTION ERROR:', error);
        return;
      }

      setIsZoomConnected(!!data);
    } catch (error) {
      console.log('CHECK ZOOM CONNECTION ERROR:', error);
    }
  };

  // ---------------------------------------------------------
  // Google OAuth
  // ---------------------------------------------------------

  const handleConnectGoogle = async () => {
    if (isConnectingGoogle || isGoogleConnected) {
      return;
    }

    try {
      setIsConnectingGoogle(true);

      const { authorizationUrl, error } = await GoogleAuthService.startOAuth();

      if (error || !authorizationUrl) {
        Alert.alert(
          'Google Connection',
          error || 'Unable to connect Google account.',
        );

        setIsConnectingGoogle(false);
        return;
      }

      setGoogleAuthUrl(authorizationUrl);
    } catch (error) {
      console.error('CONNECT GOOGLE ERROR:', error);

      Alert.alert(
        'Google Connection',
        'Unable to connect Google account. Please try again.',
      );

      setIsConnectingGoogle(false);
    }
  };

  const handleGoogleWebViewNavigation = async (url: string) => {
    const isGoogleCallback = url.includes(
      '/functions/v1/google-oauth-callback',
    );

    if (!isGoogleCallback) {
      return;
    }

    /*
     * The callback Edge Function completes the OAuth process,
     * saves the Google integration, and returns its HTML.
     */
    setGoogleAuthUrl(null);

    await checkGoogleConnection();

    setIsConnectingGoogle(false);
  };

  const handleCloseGoogleWebView = () => {
    setGoogleAuthUrl(null);
    setIsConnectingGoogle(false);
  };

  // ---------------------------------------------------------
  // Zoom OAuth
  // ---------------------------------------------------------

  const handleConnectZoom = async () => {
    if (isConnectingZoom || isZoomConnected) {
      return;
    }

    try {
      setIsConnectingZoom(true);

      const { authorizationUrl, error } = await ZoomAuthService.startOAuth();

      if (error || !authorizationUrl) {
        Alert.alert(
          'Zoom Connection',
          error || 'Unable to connect Zoom account.',
        );

        setIsConnectingZoom(false);
        return;
      }

      setZoomAuthUrl(authorizationUrl);
    } catch (error) {
      console.error('CONNECT ZOOM ERROR:', error);

      Alert.alert(
        'Zoom Connection',
        'Unable to connect Zoom account. Please try again.',
      );

      setIsConnectingZoom(false);
    }
  };

  const handleZoomWebViewNavigation = async (url: string) => {
    console.log('ZOOM WEBVIEW URL:', url);

    const isZoomCallback = url.includes('/functions/v1/zoom-oauth');

    if (!isZoomCallback) {
      return;
    }

    console.log('ZOOM CALLBACK DETECTED:', url);

    setZoomAuthUrl(null);

    setTimeout(async () => {
      await checkZoomConnection();
      setIsConnectingZoom(false);
    }, 500);
  };

  const handleCloseZoomWebView = () => {
    setZoomAuthUrl(null);
    setIsConnectingZoom(false);
  };

  // ---------------------------------------------------------
  // Initial connection checks
  // ---------------------------------------------------------

  useEffect(() => {
    refreshSubscription();
    checkGoogleConnection();
    checkZoomConnection();
  }, []);

  // ---------------------------------------------------------
  // Refresh connection status when app becomes active
  // ---------------------------------------------------------

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener(
      'change',
      nextState => {
        if (nextState === 'active') {
          checkGoogleConnection();
          checkZoomConnection();
        }
      },
    );

    return () => {
      appStateSubscription.remove();
    };
  }, [user?.id]);

  const zeroRetention = user?.zeroRetentionEnabled ?? true;
  const autoBook = user?.autoBookEnabled ?? false;
  const nylasStatus = user?.nylasAccountStatus || 'connected';
  const lastSynced = user?.lastEmailSyncedAt
    ? 'synced 1m ago'
    : 'synced recently';

  return (
    <View>
      {/* Profile Picture */}
      <View style={{ alignItems: 'center', marginBottom: 24 }}>
        <Pressable onPress={handleProfilePicturePress}>
          <View
            style={{
              width: 88,
              height: 88,
              borderRadius: 44,
              backgroundColor: '#E2E8F0',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                fontSize: 28,
                color: '#64748B',
                fontWeight: '600',
              }}
            >
              👤
            </Text>
          </View>

          <View
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              backgroundColor: '#334155',
              borderRadius: 12,
              width: 24,
              height: 24,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: '#FFFFFF',
            }}
          >
            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 12,
                fontWeight: '700',
              }}
            >
              +
            </Text>
          </View>
        </Pressable>
      </View>

      {/* Full Name */}
      <View style={{ marginBottom: 24 }}>
        <InputField
          placeholder="Full Name"
          focusedInput={focusedInput}
          inputKey="fullName"
          value={fullName}
          onChangeText={setFullName}
          onFocus={setFocusedInput}
          onBlur={() => setFocusedInput(null)}
        />
      </View>

      {/* Privacy & Automation */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Privacy & Automation</Text>
      </View>

      <View style={styles.card}>
        <Pressable style={styles.row} onPress={toggleZeroRetention}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Zero-retention mode</Text>

            <Text style={styles.rowSub}>
              No data kept by model providers · enforced on every request
            </Text>
          </View>

          <View
            style={[
              styles.pill,
              zeroRetention ? styles.pillActive : styles.pillOff,
            ]}
          >
            <Text
              style={[styles.pillText, !zeroRetention && styles.pillTextOff]}
            >
              {zeroRetention ? 'Always on' : 'Off'}
            </Text>
          </View>
        </Pressable>

        <Pressable
          style={[styles.row, { borderBottomWidth: 0 }]}
          onPress={toggleAutoBook}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Auto-book on confirm</Text>

            <Text style={styles.rowSub}>
              Execute booking without a second tap
            </Text>
          </View>

          <View style={[styles.toggleTrack, autoBook && styles.toggleTrackOn]}>
            <View
              style={[styles.toggleThumb, autoBook && styles.toggleThumbOn]}
            />
          </View>
        </Pressable>
      </View>

      {/* Connected Accounts */}
      <View style={{ marginTop: 24 }}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Connected Accounts</Text>
        </View>

        <View style={styles.card}>
          {/* Google */}
          <Pressable
            style={styles.row}
            onPress={handleConnectGoogle}
            disabled={isConnectingGoogle || isGoogleConnected}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Google</Text>

              <Text style={styles.rowSub}>
                Connect your Google account for Google Meet
              </Text>
            </View>

            {isConnectingGoogle ? (
              <ActivityIndicator />
            ) : isGoogleConnected ? (
              <View style={[styles.pill, styles.pillActive]}>
                <Text style={styles.pillText}>Connected</Text>
              </View>
            ) : (
              <View style={[styles.pill, styles.pillOff]}>
                <Text style={[styles.pillText, styles.pillTextOff]}>
                  Connect
                </Text>
              </View>
            )}
          </Pressable>

          {/* Zoom */}
          <Pressable
            style={[styles.row, { borderBottomWidth: 0 }]}
            onPress={handleConnectZoom}
            disabled={isConnectingZoom || isZoomConnected}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Zoom</Text>

              <Text style={styles.rowSub}>
                Connect your Zoom account for meetings
              </Text>
            </View>

            {isConnectingZoom ? (
              <ActivityIndicator />
            ) : isZoomConnected ? (
              <View style={[styles.pill, styles.pillActive]}>
                <Text style={styles.pillText}>Connected</Text>
              </View>
            ) : (
              <View style={[styles.pill, styles.pillOff]}>
                <Text style={[styles.pillText, styles.pillTextOff]}>
                  Connect
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* Save */}
      <View style={{ marginTop: 24 }}>
        <Pressable
          style={{
            backgroundColor: '#111827',
            paddingVertical: 14,
            borderRadius: 12,
            alignItems: 'center',
          }}
          onPress={handleSaveProfile}
        >
          <Text
            style={{
              color: '#FFFFFF',
              fontWeight: '600',
              fontSize: 15,
            }}
          >
            Save
          </Text>
        </Pressable>
      </View>

      {/* Change Password */}
      <View style={{ marginTop: 12 }}>
        <Pressable
          style={{
            backgroundColor: '#F1F5F9',
            paddingVertical: 14,
            borderRadius: 12,
            alignItems: 'center',
          }}
          onPress={handleChangePassword}
        >
          <Text
            style={{
              color: '#334155',
              fontWeight: '600',
              fontSize: 15,
            }}
          >
            Change Password
          </Text>
        </Pressable>
      </View>

      {/* Sign out */}
      <View style={{ marginTop: 12 }}>
        <Pressable
          style={{
            backgroundColor: '#FEE2E2',
            paddingVertical: 14,
            borderRadius: 12,
            alignItems: 'center',
          }}
          onPress={handleLogout}
        >
          <Text
            style={{
              color: '#EF4444',
              fontWeight: '600',
              fontSize: 15,
            }}
          >
            Sign out
          </Text>
        </Pressable>
      </View>

      {/* ===================================================== */}
      {/* Google OAuth WebView */}
      {/* ===================================================== */}

      <InAppWebView
        visible={!!googleAuthUrl}
        url={googleAuthUrl}
        title="Google"
        onClose={handleCloseGoogleWebView}
        onNavigationStateChange={handleGoogleWebViewNavigation}
      />

      {/* ===================================================== */}
      {/* Zoom OAuth WebView */}
      {/* ===================================================== */}

      <InAppWebView
        visible={!!zoomAuthUrl}
        url={zoomAuthUrl}
        title="Zoom"
        onClose={handleCloseZoomWebView}
        onNavigationStateChange={handleZoomWebViewNavigation}
      />
    </View>
  );
}
