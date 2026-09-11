import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import Ionicons from '@react-native-vector-icons/ionicons';

interface InAppWebViewProps {
  visible: boolean;
  url: string | null;
  title?: string;
  onClose: () => void;
  onNavigationStateChange?: (url: string) => void;
}

export function InAppWebView({
  visible,
  url,
  title = '',
  onClose,
  onNavigationStateChange,
}: InAppWebViewProps) {
  const [loading, setLoading] = useState(true);
  const insets = useSafeAreaInsets();

  if (!url) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={screenStyles.container}>
        <View
          style={[
            screenStyles.header,
            {
              paddingTop: insets.top,
              height: 56 + insets.top,
            },
          ]}
        >
          <View style={screenStyles.headerContent}>
            <View style={screenStyles.headerTitleContainer}>
              {title ? (
                <Text style={screenStyles.headerTitle} numberOfLines={1}>
                  {title}
                </Text>
              ) : null}
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={screenStyles.closeButton}
              hitSlop={10}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={24} color="#111827" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={screenStyles.webViewContainer}>
          <WebView
            source={{ uri: url }}
            style={screenStyles.webView}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onShouldStartLoadWithRequest={request => {
              console.log('===== WEBVIEW REQUEST =====');
              console.log(request.url);

              const requestUrl = request.url;

              const isNylasCallback = requestUrl.includes(
                '/functions/v1/nylas-oauth-callback',
              );

              console.log('IS NYLAS CALLBACK:', isNylasCallback);

              if (isNylasCallback) {
                console.log('NYLAS CALLBACK ALLOWED TO CONTINUE:', requestUrl);

                return true;
              }

              const callbackPath = '/functions/v1/duffel-checkout-callback';

              if (requestUrl.includes(callbackPath)) {
                console.log(
                  'Duffel callback navigation intercepted:',
                  requestUrl,
                );

                onNavigationStateChange?.(requestUrl);

                return false;
              }

              return true;
            }}
            onNavigationStateChange={navigationState => {
              console.log('===== WEBVIEW NAVIGATION =====');
              console.log(navigationState.url);

              const navigationUrl = navigationState.url;

              /*
               * Existing Duffel behavior.
               * Do not change this.
               */
              const callbackPath = '/functions/v1/duffel-checkout-callback';

              if (navigationUrl.includes(callbackPath)) {
                return;
              }

              onNavigationStateChange?.(navigationUrl);
            }}
            allowsBackForwardNavigationGestures
          />

          {loading && (
            <View style={screenStyles.loadingOverlay}>
              <ActivityIndicator size="large" color="#111827" />

              <Text style={screenStyles.loadingText}>Loading...</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const screenStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  header: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },

  headerContent: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },

  headerTitleContainer: {
    flex: 1,
  },

  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },

  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },

  webViewContainer: {
    flex: 1,
    position: 'relative',
  },

  webView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },

  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#6B7280',
  },
});
