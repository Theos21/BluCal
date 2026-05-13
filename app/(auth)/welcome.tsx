import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import { radius, space, type as typo, useTheme } from '../../lib/theme';

function LogoMark({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 80 80">
      <Circle
        cx={40}
        cy={40}
        r={32}
        stroke={color}
        strokeWidth={5.5}
        strokeLinecap="round"
        strokeDasharray="167 34"
        strokeDashoffset={25}
        fill="none"
      />
      <Circle
        cx={40}
        cy={40}
        r={21}
        stroke={color}
        strokeWidth={4.5}
        strokeLinecap="round"
        strokeDasharray="110 22"
        strokeDashoffset={17}
        strokeOpacity={0.65}
        fill="none"
      />
      <Circle
        cx={40}
        cy={40}
        r={10}
        stroke={color}
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeDasharray="52 10"
        strokeDashoffset={8}
        strokeOpacity={0.35}
        fill="none"
      />
      <Circle cx={40} cy={40} r={3.5} fill={color} />
    </Svg>
  );
}

export default function Welcome() {
  const t = useTheme();
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: t.bg }}
      edges={['top', 'left', 'right', 'bottom']}
    >
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: space.xl,
        }}
      >
        <LogoMark size={80} color={t.primary} />
        <Text
          style={[
            typo.largeTitle,
            {
              color: t.primary,
              marginTop: space.lg,
              letterSpacing: -0.5,
            },
          ]}
        >
          BluCal
        </Text>
        <Text
          style={[
            typo.subhead,
            { color: t.textSec, marginTop: space.sm },
          ]}
        >
          Your nutrition, your way
        </Text>
      </View>

      <View
        style={{
          paddingHorizontal: space.lg,
          paddingBottom: space.lg,
        }}
      >
        <Pressable
          onPress={() => router.push('/(auth)/signup')}
          style={({ pressed }) => ({
            height: 52,
            borderRadius: radius.lg,
            backgroundColor: t.primary,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={[typo.headline, { color: t.textOnPrim }]}>
            Get started
          </Text>
        </Pressable>
        <Pressable
          hitSlop={8}
          onPress={() => router.push('/(auth)/signin')}
          style={({ pressed }) => ({
            alignItems: 'center',
            marginTop: space.lg,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text style={[typo.subhead, { color: t.primary }]}>
            I already have an account
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
