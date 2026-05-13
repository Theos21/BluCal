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
import { radius, space, type as typo, useTheme, type Theme } from '../../lib/theme';
import { signIn } from '../../lib/auth';

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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  const handleForgotPassword = () => {
    Alert.alert('Coming soon', 'Password reset will be available soon.');
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
