import React, { useEffect } from 'react';
import { View, StatusBar, AppState, AppStateStatus } from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, { EventType } from 'react-native-notify-kit';

import styles from './src/styles/styles';
import { AuthProvider } from './src/context/AuthContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import AppStripeProvider from './src/providers/AppStripeProvider';

import MessageToast, { MessageToastRef } from './src/components/MessageToast';

import { setMessageToastRef } from './src/services/messageToast';
import { NotificationService } from './src/services/notificationService';

import { navigationRef, navigateToInbox } from './src/navigation/navigationRef';

const PENDING_NOTIFICATION_ROUTE = 'pending_notification_route';

function App() {
  useEffect(() => {
    NotificationService.initialize();
  }, []);

  return (
    <SafeAreaProvider>
      <AppStripeProvider>
        <AuthProvider>
          <StatusBar barStyle="dark-content" backgroundColor="#F5F7FB" />

          <AppContent />
        </AuthProvider>
      </AppStripeProvider>
    </SafeAreaProvider>
  );
}

function AppContent() {
  const safeAreaInsets = useSafeAreaInsets();

  /*
   * Handle notification taps while the app is already
   * running in the foreground.
   */
  useEffect(() => {
    return notifee.onForegroundEvent(({ type, detail }) => {
      if (
        type === EventType.PRESS &&
        detail.notification?.data?.screen === 'Inbox'
      ) {
        navigateToInbox();
      }
    });
  }, []);

  /*
   * Check for a notification route that was saved by
   * index.js while the app was in the background.
   */
  useEffect(() => {
    let isMounted = true;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const checkPendingNotification = async () => {
      try {
        const pendingRoute = await AsyncStorage.getItem(
          PENDING_NOTIFICATION_ROUTE,
        );

        if (!isMounted || pendingRoute !== 'Inbox') {
          return;
        }

        const waitForNavigation = () => {
          if (!isMounted) {
            return;
          }

          if (navigationRef.isReady()) {
            navigateToInbox();

            AsyncStorage.removeItem(PENDING_NOTIFICATION_ROUTE).catch(error => {
              console.error(
                'Failed to clear pending notification route:',
                error,
              );
            });

            return;
          }

          timeoutId = setTimeout(waitForNavigation, 100);
        };

        waitForNavigation();
      } catch (error) {
        console.error('Pending notification navigation error:', error);
      }
    };

    checkPendingNotification();

    /*
     * AppContent remains mounted while the app moves between
     * background and foreground, so we check again whenever
     * the app becomes active.
     */
    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState === 'active') {
          checkPendingNotification();
        }
      },
    );

    return () => {
      isMounted = false;

      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }

      subscription.remove();
    };
  }, []);

  return (
    <View
      style={[
        styles.screenRoot,
        {
          paddingTop: safeAreaInsets.top,
          paddingBottom: safeAreaInsets.bottom,
        },
      ]}
    >
      <AppNavigator />

      {/* Global Message Toast */}
      <MessageToast
        ref={(ref: MessageToastRef | null) => {
          setMessageToastRef(ref);
        }}
      />
    </View>
  );
}

export default App;
