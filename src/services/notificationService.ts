import notifee, {
  AndroidImportance,
  AuthorizationStatus,
} from 'react-native-notify-kit';

const EMAIL_CHANNEL_ID = 'email-actionable';

export const NotificationService = {
  async initialize(): Promise<boolean> {
    try {
      const permission = await notifee.requestPermission();

      const authorized =
        permission.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
        permission.authorizationStatus === AuthorizationStatus.PROVISIONAL;

      if (!authorized) {
        console.log('Notification permission not granted');
        return false;
      }

      await notifee.createChannel({
        id: EMAIL_CHANNEL_ID,
        name: 'Email Notifications',
        importance: AndroidImportance.DEFAULT,
      });

      return true;
    } catch (error) {
      console.error('Notification initialization error:', error);
      return false;
    }
  },

  async showActionableEmailNotification(count: number): Promise<void> {
    try {
      const initialized = await this.initialize();

      if (!initialized) {
        return;
      }

      await notifee.displayNotification({
        title: 'Emails Need Your Attention',
        body: `You have ${count} email${
          count === 1 ? '' : 's'
        } that need your attention.`,
        data: {
          screen: 'Inbox',
        },
        android: {
          channelId: EMAIL_CHANNEL_ID,
          pressAction: {
            id: 'open-inbox',
          },
        },
      });
    } catch (error) {
      console.error('Actionable email notification error:', error);
    }
  },
};
