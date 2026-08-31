import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type MessageToastType = 'success' | 'error' | 'validation';

export interface MessageToastOptions {
  type?: MessageToastType;
  title?: string;
  message: string;
  duration?: number;
  showCloseButton?: boolean;
}

export interface MessageToastRef {
  show: (options: MessageToastOptions) => void;
  hide: () => void;
}

const DEFAULT_DURATION = 3000;

const MessageToast = forwardRef<MessageToastRef>((_, ref) => {
  const insets = useSafeAreaInsets();

  const [toast, setToast] = React.useState<MessageToastOptions | null>(null);

  const translateY = useRef(new Animated.Value(-150)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -150,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setToast(null);
      }
    });
  };

  const show = (options: MessageToastOptions) => {
    // Clear existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // Set new toast
    setToast(options);

    // Reset animation
    translateY.setValue(-150);
    opacity.setValue(0);

    // Show
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        tension: 70,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto hide
    const duration = options.duration ?? DEFAULT_DURATION;

    if (duration > 0) {
      timerRef.current = setTimeout(() => {
        hide();
      }, duration);
    }
  };

  useImperativeHandle(ref, () => ({
    show,
    hide,
  }));

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  if (!toast) {
    return null;
  }

  const type = toast.type ?? 'success';

  const getToastStyle = () => {
    switch (type) {
      case 'error':
        return styles.error;

      case 'validation':
        return styles.validation;

      case 'success':
      default:
        return styles.success;
    }
  };

  const getTextStyle = () => {
    switch (type) {
      case 'error':
        return styles.errorText;

      case 'validation':
        return styles.validationText;

      case 'success':
      default:
        return styles.successText;
    }
  };

  return (
    <Animated.View
      pointerEvents="auto"
      style={[
        styles.container,
        {
          top: insets.top + 10,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={[styles.toast, getToastStyle()]}>
        <View style={styles.content}>
          {!!toast.title && (
            <Text style={[styles.title, getTextStyle()]}>{toast.title}</Text>
          )}

          <Text style={[styles.message, getTextStyle()]}>{toast.message}</Text>
        </View>

        {toast.showCloseButton !== false && (
          <Pressable onPress={hide} hitSlop={10} style={styles.closeButton}>
            <Text style={[styles.closeText, getTextStyle()]}>×</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
});

MessageToast.displayName = 'MessageToast';

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 10,
    right: 10,
    zIndex: 9999,
    elevation: 9999,
  },

  toast: {
    minHeight: 64,
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.15,
    shadowRadius: 6,

    elevation: 6,
  },

  content: {
    flex: 1,
    paddingRight: 8,
  },

  title: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 3,
  },

  message: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  },

  closeButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  closeText: {
    fontSize: 25,
    fontWeight: '300',
    lineHeight: 25,
  },

  success: {
    backgroundColor: '#C8F0E8',
  },

  successText: {
    color: '#17665B',
  },

  error: {
    backgroundColor: '#F8D4D4',
  },

  errorText: {
    color: '#9B2929',
  },

  validation: {
    backgroundColor: '#FCE8B2',
  },

  validationText: {
    color: '#8A6200',
  },
});

export default MessageToast;
