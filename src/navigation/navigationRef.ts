import { createNavigationContainerRef } from '@react-navigation/native';
import { RootStackParamList } from '../types/navigation';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigateToInbox() {
  if (!navigationRef.isReady()) {
    return;
  }

  navigationRef.navigate('MainTabs', {
    screen: 'Inbox',
  });
}
