import { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  Share,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { radius, space, type as typo, useTheme } from '../lib/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  streakDays: number;
};

export default function StreakCelebration({
  visible,
  onClose,
  streakDays,
}: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.15,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1.0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [visible, scale]);

  const handleShare = () => {
    Share.share({
      message: `I am on a ${streakDays}-day streak on BluCal!`,
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: t.scrim,
          justifyContent: 'flex-end',
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: t.surface,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            padding: space.xl,
            paddingBottom: insets.bottom + space.xl,
            alignItems: 'center',
          }}
        >
          <Animated.View style={{ transform: [{ scale }] }}>
            <Ionicons name="flame-outline" size={64} color={t.warn} />
          </Animated.View>
          <Text
            style={[
              typo.largeTitle,
              {
                color: t.text,
                marginTop: space.lg,
                textAlign: 'center',
              },
            ]}
          >
            {`${streakDays}-day streak!`}
          </Text>
          <Text
            style={[
              typo.subhead,
              {
                color: t.textSec,
                marginTop: space.sm,
                textAlign: 'center',
              },
            ]}
          >
            You have been logging consistently. Keep it up!
          </Text>

          <Pressable
            onPress={handleShare}
            style={({ pressed }) => ({
              marginTop: space.xl,
              alignSelf: 'stretch',
              height: 48,
              borderRadius: radius.lg,
              backgroundColor: t.surface2,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: space.sm,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Ionicons name="share-outline" size={18} color={t.text} />
            <Text style={[typo.subhead, { color: t.text }]}>
              Share your streak
            </Text>
          </Pressable>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => ({
              marginTop: space.md,
              alignSelf: 'stretch',
              height: 52,
              borderRadius: radius.lg,
              backgroundColor: t.primary,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={[typo.headline, { color: t.textOnPrim }]}>
              Keep going
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
