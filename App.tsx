import React from 'react';
import { View, StatusBar } from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import styles from './src/styles/styles';
import { AuthProvider } from './src/context/AuthContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import AppStripeProvider from './src/providers/AppStripeProvider';

import MessageToast, { MessageToastRef } from './src/components/MessageToast';

import { setMessageToastRef } from './src/services/messageToast';

function App() {
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
