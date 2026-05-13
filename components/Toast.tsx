import { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, space, type as typo, useTheme } from '../lib/theme';
import type { ToastType } from '../lib/useToast';

type Props = {
  message: string;
  visible: boolean;
  onHide: () => void;
  type?: ToastType;
  duration?: number;
};

const HIDDEN_Y = -100;
const SLIDE_MS = 250;
const DEFAULT_DURATION_MS = 2000;

export default function Toast({
  message,
  visible,
  onHide,
  type = 'success',
  duration = DEFAULT_DURATION_MS,
}: Props) {
  const t = useTheme();
  const translateY = useRef(new Animated.Value(HIDDEN_Y)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(translateY, {
        toValue: 0,
        duration: SLIDE_MS,
        useNativeDriver: true,
      }).start();
      const timer = setTimeout(onHide, duration);
      return () => clearTimeout(timer);
    }
    Animated.timing(translateY, {
      toValue: HIDDEN_Y,
      duration: SLIDE_MS,
      useNativeDriver: true,
    }).start();
  }, [visible, onHide, duration, translateY]);

  const accent =
    type === 'error'
      ? t.danger
      : type === 'info'
      ? t.primary
      : t.success;
  const iconName =
    type === 'error'
      ? 'alert-circle-outline'
      : type === 'info'
      ? 'information-circle-outline'
      : 'checkmark-circle-outline';

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 60,
        left: 16,
        right: 16,
        backgroundColor: t.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: t.hairline,
        flexDirection: 'row',
        alignItems: 'stretch',
        transform: [{ translateY }],
        zIndex: 100,
      }}
    >
      <View
        style={{
          width: 3,
          marginVertical: 6,
          marginLeft: 6,
          borderRadius: radius.pill,
          backgroundColor: accent,
        }}
      />
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
          paddingHorizontal: space.md,
          paddingVertical: space.sm,
        }}
      >
        <Ionicons name={iconName} size={18} color={accent} />
        <Text
          style={[typo.subhead, { color: t.text, flex: 1 }]}
          numberOfLines={1}
        >
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}
