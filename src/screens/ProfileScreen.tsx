import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Alert,
  ActivityIndicator,
  AppState,
} from 'react-native';
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

  /*
   * Prevent the same Zoom OAuth callback from being
   * processed multiple times.
   */
  const zoomCallbackHandledRef = useRef(false);

  /*
   * Used to prevent an old async callback/check from
   * updating the UI after a new OAuth attempt has started.
   */
  const zoomConnectionAttemptRef = useRef(0);

  // Nylas OAuth
  const [isConnectingNylas, setIsConnectingNylas] = useState(false);
  const [isNylasConnected, setIsNylasConnected] = useState(false);
  const [nylasAuthUrl, setNylasAuthUrl] = useState<string | null>(null);

  /*
   * Prevent the same Nylas OAuth callback from being
   * processed multiple times.
   */
  const nylasCallbackHandledRef = useRef(false);

  /*
   * Used to prevent an old Nylas callback from
   * updating the UI after a new OAuth attempt has started.
   */
  const nylasConnectionAttemptRef = useRef(0);

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

  const checkZoomConnection = async (): Promise<boolean> => {
    if (!user?.id) {
      setIsZoomConnected(false);
      return false;
    }

    try {
      const { data, error } = await supabase
        .from('zoom_integrations')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.log('CHECK ZOOM CONNECTION ERROR:', error);

        return false;
      }

      const connected = !!data;

      setIsZoomConnected(connected);

      console.log('ZOOM CONNECTION STATUS:', connected);

      return connected;
    } catch (error) {
      console.log('CHECK ZOOM CONNECTION ERROR:', error);

      return false;
    }
  };

  // ---------------------------------------------------------
  // Nylas connection check
  // ---------------------------------------------------------

  const checkNylasConnection = async (): Promise<boolean> => {
    if (!user?.id) {
      setIsNylasConnected(false);
      return false;
    }

    try {
      const { data, error } = await supabase
        .from('nylas_integrations')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.log('CHECK NYLAS CONNECTION ERROR:', error);

        return false;
      }

      const connected = !!data;

      setIsNylasConnected(connected);

      console.log('NYLAS CONNECTION STATUS:', connected);

      return connected;
    } catch (error) {
      console.log('CHECK NYLAS CONNECTION ERROR:', error);

      return false;
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

      /*
       * Start a completely new Zoom OAuth attempt.
       */
      zoomCallbackHandledRef.current = false;

      zoomConnectionAttemptRef.current += 1;

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

    /*
     * WebView can fire navigation events more than once
     * for the same callback URL.
     */
    if (zoomCallbackHandledRef.current) {
      console.log('ZOOM CALLBACK ALREADY HANDLED');

      return;
    }

    zoomCallbackHandledRef.current = true;

    const currentAttempt = zoomConnectionAttemptRef.current;

    console.log('ZOOM CALLBACK DETECTED');

    /*
     * Do not immediately close the WebView.
     *
     * The Zoom callback Edge Function needs time to:
     *
     * 1. Validate state
     * 2. Exchange authorization code
     * 3. Fetch Zoom user
     * 4. Save zoom_integrations
     */
    console.log('WAITING FOR ZOOM OAUTH TO COMPLETE...');

    await new Promise<void>(resolve => {
      setTimeout(resolve, 1500);
    });

    let connected = false;

    for (let attempt = 1; attempt <= 5; attempt++) {
      if (currentAttempt !== zoomConnectionAttemptRef.current) {
        console.log('ZOOM CALLBACK BELONGS TO AN OLD ATTEMPT');

        return;
      }

      console.log(`CHECKING ZOOM CONNECTION - ATTEMPT ${attempt}/5`);

      connected = await checkZoomConnection();

      if (connected) {
        console.log('ZOOM CONNECTION CONFIRMED');

        break;
      }

      if (attempt < 5) {
        await new Promise<void>(resolve => {
          setTimeout(resolve, 1000);
        });
      }
    }

    if (connected) {
      setIsZoomConnected(true);
    }

    setZoomAuthUrl(null);

    setIsConnectingZoom(false);

    if (!connected) {
      console.log('ZOOM CONNECTION COULD NOT BE CONFIRMED AFTER RETRIES');
    }
  };

  const handleCloseZoomWebView = () => {
    console.log('ZOOM WEBVIEW CLOSED');

    zoomConnectionAttemptRef.current += 1;

    zoomCallbackHandledRef.current = false;

    setZoomAuthUrl(null);
    setIsConnectingZoom(false);
  };

  // ---------------------------------------------------------
  // Nylas OAuth
  // ---------------------------------------------------------

  const handleConnectNylas = async () => {
    if (isConnectingNylas || isNylasConnected) {
      return;
    }

    try {
      console.log('STARTING NYLAS OAUTH');

      setIsConnectingNylas(true);

      /*
       * Start a completely new Nylas OAuth attempt.
       */
      nylasCallbackHandledRef.current = false;
      nylasConnectionAttemptRef.current += 1;

      const { data, error } = await supabase.functions.invoke(
        'nylas-oauth-start',
      );

      console.log('NYLAS OAUTH START RESPONSE:', data);
      console.log('NYLAS OAUTH START ERROR:', error);

      if (error) {
        console.error('NYLAS OAUTH START ERROR:', error);

        Alert.alert(
          'Nylas Connection',
          error.message || 'Unable to connect your email account.',
        );

        setIsConnectingNylas(false);
        return;
      }

      const authorizationUrl = data?.authorizationUrl;

      if (!authorizationUrl) {
        console.error('NYLAS OAUTH START RESPONSE:', data);

        Alert.alert(
          'Nylas Connection',
          'Unable to connect your email account.',
        );

        setIsConnectingNylas(false);
        return;
      }

      console.log('NYLAS AUTHORIZATION URL:', authorizationUrl);

      setNylasAuthUrl(authorizationUrl);
    } catch (error) {
      console.error('CONNECT NYLAS ERROR:', error);

      Alert.alert(
        'Nylas Connection',
        'Unable to connect your email account. Please try again.',
      );

      setIsConnectingNylas(false);
    }
  };

  const handleNylasWebViewNavigation = async (url: string) => {
    console.log('========================================');
    console.log('NYLAS WEBVIEW URL:', url);

    const isNylasCallback = url.includes('/functions/v1/nylas-oauth-callback');

    if (!isNylasCallback) {
      return;
    }

    /*
     * WebView can fire the callback more than once.
     */
    if (nylasCallbackHandledRef.current) {
      console.log('NYLAS CALLBACK ALREADY HANDLED');
      return;
    }

    nylasCallbackHandledRef.current = true;

    const currentAttempt = nylasConnectionAttemptRef.current;

    console.log('NYLAS CALLBACK DETECTED');
    console.log('WAITING FOR NYLAS OAUTH CALLBACK TO COMPLETE...');

    /*
     * Give the callback Edge Function time to:
     *
     * 1. Validate OAuth state
     * 2. Exchange the authorization code
     * 3. Get the Nylas grant
     * 4. Insert/update nylas_integrations
     */
    await new Promise<void>(resolve => {
      setTimeout(resolve, 2000);
    });

    /*
     * Make sure this callback still belongs to the
     * current OAuth attempt.
     */
    if (currentAttempt !== nylasConnectionAttemptRef.current) {
      console.log('NYLAS CALLBACK BELONGS TO AN OLD ATTEMPT');
      return;
    }

    let connected = false;

    /*
     * The callback may still be completing on the server,
     * so verify the database a few times.
     */
    for (let attempt = 1; attempt <= 5; attempt++) {
      if (currentAttempt !== nylasConnectionAttemptRef.current) {
        console.log('NYLAS CALLBACK BELONGS TO AN OLD ATTEMPT');
        return;
      }

      console.log(`CHECKING NYLAS CONNECTION - ATTEMPT ${attempt}/5`);

      connected = await checkNylasConnection();

      if (connected) {
        console.log('NYLAS CONNECTION CONFIRMED');
        break;
      }

      if (attempt < 5) {
        await new Promise<void>(resolve => {
          setTimeout(resolve, 1000);
        });
      }
    }

    /*
     * Only show "Connected" when the backend actually
     * contains the Nylas integration.
     */
    if (connected) {
      console.log('NYLAS OAUTH SUCCESS - INTEGRATION EXISTS');

      setIsNylasConnected(true);
      setIsConnectingNylas(false);
      setNylasAuthUrl(null);

      console.log('NYLAS WEBVIEW CLOSED AFTER CONFIRMED SUCCESS');
    } else {
      /*
       * Do NOT mark the account as connected if the
       * integration was not found.
       */
      console.error(
        'NYLAS OAUTH COULD NOT BE CONFIRMED - NO INTEGRATION FOUND',
      );

      setIsNylasConnected(false);
      setIsConnectingNylas(false);
      setNylasAuthUrl(null);

      Alert.alert(
        'Nylas Connection',
        'Your email account could not be connected. Please try again.',
      );
    }

    console.log('NYLAS CONNECTION FLOW COMPLETE');
    console.log('========================================');
  };

  const handleCloseNylasWebView = () => {
    console.log('NYLAS WEBVIEW CLOSED');

    /*
     * Invalidate any currently running callback.
     */
    nylasConnectionAttemptRef.current += 1;

    nylasCallbackHandledRef.current = false;

    setNylasAuthUrl(null);
    setIsConnectingNylas(false);
  };

  // ---------------------------------------------------------
  // Keep full name synchronized with auth user
  // ---------------------------------------------------------

  useEffect(() => {
    setFullName(user?.fullName ?? '');
  }, [user?.fullName]);

  // ---------------------------------------------------------
  // Initial connection checks
  // ---------------------------------------------------------

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    refreshSubscription();

    checkGoogleConnection();
    checkZoomConnection();
    checkNylasConnection();
  }, [user?.id]);

  // ---------------------------------------------------------
  // Refresh connection status when app becomes active
  // ---------------------------------------------------------

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener(
      'change',
      nextState => {
        if (nextState === 'active' && user?.id) {
          checkGoogleConnection();
          checkZoomConnection();
          checkNylasConnection();
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
      <View
        style={{
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
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
      <View
        style={{
          marginBottom: 24,
        }}
      >
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
          style={[
            styles.row,
            {
              borderBottomWidth: 0,
            },
          ]}
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
      <View
        style={{
          marginTop: 24,
        }}
      >
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
            style={styles.row}
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

          {/* Nylas */}
          <Pressable
            style={[
              styles.row,
              {
                borderBottomWidth: 0,
              },
            ]}
            onPress={handleConnectNylas}
            disabled={isConnectingNylas || isNylasConnected}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Email & Calendar</Text>

              <Text style={styles.rowSub}>
                Connect your email and calendar account
              </Text>
            </View>

            {isConnectingNylas ? (
              <ActivityIndicator />
            ) : isNylasConnected ? (
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
      <View
        style={{
          marginTop: 24,
        }}
      >
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
      <View
        style={{
          marginTop: 12,
        }}
      >
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
      <View
        style={{
          marginTop: 12,
        }}
      >
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

      {/* Google OAuth WebView */}
      <InAppWebView
        visible={!!googleAuthUrl}
        url={googleAuthUrl}
        title="Google"
        onClose={handleCloseGoogleWebView}
        onNavigationStateChange={handleGoogleWebViewNavigation}
      />

      {/* Zoom OAuth WebView */}
      <InAppWebView
        visible={!!zoomAuthUrl}
        url={zoomAuthUrl}
        title="Zoom"
        onClose={handleCloseZoomWebView}
        onNavigationStateChange={handleZoomWebViewNavigation}
      />

      {/* Nylas OAuth WebView */}
      <InAppWebView
        visible={!!nylasAuthUrl}
        url={nylasAuthUrl}
        title="Email & Calendar"
        onClose={handleCloseNylasWebView}
        onNavigationStateChange={handleNylasWebViewNavigation}
      />
    </View>
  );
}
