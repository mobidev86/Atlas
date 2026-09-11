/**
 * @format
 */

import 'react-native-get-random-values';
import { AppRegistry } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, { EventType } from 'react-native-notify-kit';

import App from './App';
import { name as appName } from './app.json';

const PENDING_NOTIFICATION_ROUTE = 'pending_notification_route';

notifee.onBackgroundEvent(async ({ type, detail }) => {
  try {
    console.log('Notification background event:', {
      type,
      notificationId: detail.notification?.id,
      data: detail.notification?.data,
    });

    if (
      type === EventType.PRESS &&
      detail.notification?.data?.screen === 'Inbox'
    ) {
      await AsyncStorage.setItem(PENDING_NOTIFICATION_ROUTE, 'Inbox');

      console.log('Pending notification route saved:', 'Inbox');
    }
  } catch (error) {
    console.error('Notification background event error:', error);
  }
});

AppRegistry.registerComponent(appName, () => App);
