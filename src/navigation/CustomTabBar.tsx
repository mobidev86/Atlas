import React from 'react';
import { View, Pressable, Text } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import styles from '../styles/styles';

const tabIcons: Record<string, string> = {
  Home: '⌂',
  Travel: '✈️',
  Dining: '🍽️',
  Inbox: '📧',
  Profile: '👤',
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
            <Text style={styles.tabIcon}>{tabIcons[route.name] || '•'}</Text>
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
