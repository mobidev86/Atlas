import React from 'react';
import { View, Pressable, Text } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Ionicons from '@react-native-vector-icons/ionicons';
import type { IoniconsIconName } from '@react-native-vector-icons/ionicons';
import styles, { colors } from '../styles/styles';

const tabIconNames: Record<string, { outline: IoniconsIconName; filled: IoniconsIconName }> = {
  Home: { outline: 'home-outline', filled: 'home' },
  Travel: { outline: 'airplane-outline', filled: 'airplane' },
  Dining: { outline: 'restaurant-outline', filled: 'restaurant' },
  Inbox: { outline: 'mail-outline', filled: 'mail' },
  Profile: { outline: 'person-outline', filled: 'person' },
};

export function CustomTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  return (
    <View style={styles.tabBar}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label =
          options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
            ? options.title
            : route.name;

        const isFocused = state.index === index;
        const iconConfig = tabIconNames[route.name] || {
          outline: 'ellipse-outline' as IoniconsIconName,
          filled: 'ellipse' as IoniconsIconName,
        };
        const iconName = isFocused ? iconConfig.filled : iconConfig.outline;
        const iconColor = isFocused ? colors.navy : colors.slateGray;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            style={[styles.tab, isFocused ? styles.activeTab : null]}
            onPress={onPress}
          >
            <Ionicons
              name={iconName}
              size={20}
              color={iconColor}
              style={{ marginBottom: 2 }}
            />
            <Text
              style={[
                styles.tabLabel,
                isFocused ? styles.activeTabLabel : null,
              ]}
            >
              {typeof label === 'string' ? label : route.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
