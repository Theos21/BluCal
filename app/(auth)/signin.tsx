import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import * as AppleAuthentication from 'expo-apple-authentication';
import { radius, space, type as typo, useTheme, type Theme } from '../../lib/theme';
import { signIn } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { signInWithApple, signInWithGoogle } from '../../lib/socialAuth';

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

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  autoCorrect,
  textContentType,
  rightSlot,
  t,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'words' | 'sentences';
  autoCorrect?: boolean;
  textContentType?: 'emailAddress' | 'password';
  rightSlot?: React.ReactNode;
  t: Theme;
}) {
  return (
    <View>
      <Text
        style={[
          typo.caption2,
          {
            color: t.textTer,
            letterSpacing: 0.06,
            textTransform: 'uppercase',
            fontWeight: '700',
            marginBottom: 6,
          },
        ]}
      >
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: t.surface2,
          borderRadius: radius.md,
          paddingHorizontal: 14,
        }}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={t.textTer}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType ?? 'default'}
          autoCapitalize={autoCapitalize ?? 'sentences'}
          autoCorrect={autoCorrect}
          textContentType={textContentType}
          returnKeyType="next"
          style={[
            typo.body,
            {
              flex: 1,
              color: t.text,
              paddingVertical: 12,
            },
          ]}
        />
        {rightSlot}
      </View>
    </View>
  );
}

export default function SignIn() {
  const t = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<
    'apple' | 'google' | null
  >(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAppleSignIn = async () => {
    setSocialLoading('apple');
    try {
      await signInWithApple();
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
      setSocialLoading(null);
    }
  };

  const handleGoogleSignIn = async () => {
    setSocialLoading('google');
    try {
      await signInWithGoogle();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Could not sign in with Google.';
      Alert.alert('Sign in failed', message);
    } finally {
      setSocialLoading(null);
    }
  };

  const handleSubmit = async () => {
    if (!email.trim() || !password) {
      setErrorMsg('Please enter your email and password.');
      return;
    }
    setErrorMsg(null);
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.replace('/(tabs)');
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : 'Could not sign in.';
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      Alert.alert(
        'Email required',
        'Enter your email address above, then tap Forgot password again.',
      );
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: 'blucal://reset-password',
      });
      if (error) throw error;
      Alert.alert(
        'Check your email',
        `If an account exists for ${trimmed}, a password reset link is on its way.`,
      );
    } catch (e) {
      console.error(e);
      Alert.alert(
        'Could not send reset email',
        'Please check your connection and try again.',
      );
    }
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: t.bg }}
      edges={['top', 'left', 'right', 'bottom']}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: space.xl,
            paddingTop: space.sm,
            paddingBottom: space.xl,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            hitSlop={8}
            onPress={() => router.back()}
            style={({ pressed }) => ({
              alignSelf: 'flex-start',
              padding: 4,
              marginLeft: -4,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Ionicons name="chevron-back" size={28} color={t.primary} />
          </Pressable>

          <Text
            style={[typo.title1, { color: t.text, marginTop: space.lg }]}
          >
            Welcome back
          </Text>
          <Text
            style={[
              typo.subhead,
              { color: t.textSec, marginTop: space.xs },
            ]}
          >
            Sign in to continue.
          </Text>

          <View
            style={{
              marginTop: space.xl,
              backgroundColor: t.surface,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: t.hairline,
              padding: space.lg,
              gap: space.md,
            }}
          >
            <Field
              t={t}
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
            />
            <Field
              t={t}
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              secureTextEntry={!showPwd}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              rightSlot={
                <Pressable
                  hitSlop={8}
                  onPress={() => setShowPwd((v) => !v)}
                  style={({ pressed }) => ({
                    padding: 4,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Ionicons
                    name={showPwd ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={t.textSec}
                  />
                </Pressable>
              }
            />
          </View>

          <Pressable
            hitSlop={6}
            onPress={handleForgotPassword}
            style={({ pressed }) => ({
              alignSelf: 'flex-end',
              marginTop: space.sm,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text style={[typo.footnote, { color: t.primary }]}>
              Forgot password?
            </Text>
          </Pressable>

          <Pressable
            onPress={handleSubmit}
            disabled={loading}
            style={({ pressed }) => ({
              marginTop: space.lg,
              height: 52,
              borderRadius: radius.lg,
              backgroundColor: t.primary,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: loading ? 0.6 : pressed ? 0.85 : 1,
            })}
          >
            {loading ? (
              <ActivityIndicator color={t.textOnPrim} />
            ) : (
              <Text style={[typo.headline, { color: t.textOnPrim }]}>
                Sign in
              </Text>
            )}
          </Pressable>

          {errorMsg && (
            <Text
              style={[
                typo.footnote,
                {
                  color: t.danger,
                  marginTop: space.md,
                  textAlign: 'center',
                },
              ]}
            >
              {errorMsg}
            </Text>
          )}

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: space.xl,
              marginBottom: space.md,
            }}
          >
            <View
              style={{ flex: 1, height: 0.5, backgroundColor: t.hairline }}
            />
            <Text
              style={[
                typo.footnote,
                { color: t.textTer, marginHorizontal: space.md },
              ]}
            >
              or
            </Text>
            <View
              style={{ flex: 1, height: 0.5, backgroundColor: t.hairline }}
            />
          </View>

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
            disabled={socialLoading !== null}
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
              opacity: socialLoading ? 0.6 : pressed ? 0.85 : 1,
            })}
          >
            {socialLoading === 'google' ? (
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

          <Pressable
            hitSlop={8}
            onPress={() => router.push('/(auth)/signup')}
            style={({ pressed }) => ({
              alignSelf: 'center',
              marginTop: space.xl,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text style={[typo.subhead, { color: t.textSec }]}>
              {"Don't have an account? "}
              <Text style={{ color: t.primary, fontWeight: '600' }}>
                Sign up
              </Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
