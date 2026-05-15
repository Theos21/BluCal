import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';
import * as AppleAuthentication from 'expo-apple-authentication';
import { radius, space, type as typo, useTheme, type Theme } from '../../lib/theme';
import { signInWithApple, signInWithGoogle } from '../../lib/socialAuth';
import { BluCalWordmark } from '../../components/BluCalWordmark';

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

// Google's official "G" logo. Four-color SVG path data from Google's brand
// guidelines — required by their sign-in branding rules.
function GoogleGlyph({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <Path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <Path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <Path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </Svg>
  );
}

function Divider({ t }: { t: Theme }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: space.lg,
        marginBottom: space.md,
      }}
    >
      <View style={{ flex: 1, height: 0.5, backgroundColor: t.hairline }} />
      <Text
        style={[
          typo.footnote,
          { color: t.textTer, marginHorizontal: space.md },
        ]}
      >
        or
      </Text>
      <View style={{ flex: 1, height: 0.5, backgroundColor: t.hairline }} />
    </View>
  );
}

export default function Welcome() {
  const t = useTheme();
  const [loading, setLoading] = useState<'apple' | 'google' | null>(null);

  const handleAppleSignIn = async () => {
    setLoading('apple');
    try {
      await signInWithApple();
      // AuthContext / RootNavigator routes the new session to tabs or
      // onboarding based on profile.goal.
    } catch (e) {
      const code =
        e && typeof e === 'object' && 'code' in e
          ? (e as { code?: string }).code
          : undefined;
      if (code !== 'ERR_REQUEST_CANCELED') {
        const message =
          e instanceof Error ? e.message : 'Could not sign in with Apple.';
        Alert.alert('Sign in failed', message);
      }
    } finally {
      setLoading(null);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading('google');
    try {
      await signInWithGoogle();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Could not sign in with Google.';
      Alert.alert('Sign in failed', message);
    } finally {
      setLoading(null);
    }
  };

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
        <View style={{ marginTop: space.lg }}>
          <BluCalWordmark size={34} />
        </View>
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

        <Divider t={t} />

        <AppleAuthentication.AppleAuthenticationButton
          buttonType={
            AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
          }
          buttonStyle={
            t.mode === 'dark'
              ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
              : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
          }
          cornerRadius={radius.lg}
          style={{ width: '100%', height: 52 }}
          onPress={handleAppleSignIn}
        />

        <Pressable
          onPress={handleGoogleSignIn}
          disabled={loading !== null}
          style={({ pressed }) => ({
            marginTop: space.md,
            height: 52,
            borderRadius: radius.lg,
            backgroundColor: t.surface,
            borderWidth: 1,
            borderColor: t.hairline,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: space.sm,
            opacity: loading ? 0.6 : pressed ? 0.85 : 1,
          })}
        >
          {loading === 'google' ? (
            <ActivityIndicator color={t.text} />
          ) : (
            <>
              <GoogleGlyph size={20} />
              <Text style={[typo.headline, { color: t.text }]}>
                Continue with Google
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
