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
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../lib/theme';
import { supabase } from '../../lib/supabase';

export default function ResetPassword() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canSave = password.length >= 8 && password === confirm;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError('');
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) throw updateError;
      Alert.alert(
        'Password updated',
        'Your password has been updated successfully.',
        [
          {
            text: 'Sign in',
            onPress: () => router.replace('/(auth)/signin'),
          },
        ],
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Could not update password. Try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          padding: 24,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ marginBottom: 32 }}>
          <Text
            style={{
              fontSize: 28,
              fontWeight: '700',
              color: t.text,
              marginBottom: 8,
            }}
          >
            Reset password
          </Text>
          <Text style={{ fontSize: 15, color: t.textSec, lineHeight: 22 }}>
            Enter your new password below.
          </Text>
        </View>

        <View style={{ marginBottom: 12 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: t.textSec,
              marginBottom: 6,
            }}
          >
            New password
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: t.surface2,
              borderRadius: 12,
              paddingHorizontal: 16,
            }}
          >
            <TextInput
              style={{ flex: 1, height: 52, fontSize: 16, color: t.text }}
              placeholder="At least 8 characters"
              placeholderTextColor={t.textTer}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
            />
            <Pressable onPress={() => setShowPassword((v) => !v)}>
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={t.textTer}
              />
            </Pressable>
          </View>
        </View>

        <View style={{ marginBottom: 24 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: t.textSec,
              marginBottom: 6,
            }}
          >
            Confirm password
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: t.surface2,
              borderRadius: 12,
              paddingHorizontal: 16,
            }}
          >
            <TextInput
              style={{ flex: 1, height: 52, fontSize: 16, color: t.text }}
              placeholder="Re-enter your password"
              placeholderTextColor={t.textTer}
              secureTextEntry={!showConfirm}
              value={confirm}
              onChangeText={setConfirm}
              autoCapitalize="none"
            />
            <Pressable onPress={() => setShowConfirm((v) => !v)}>
              <Ionicons
                name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={t.textTer}
              />
            </Pressable>
          </View>
        </View>

        {error ? (
          <Text style={{ fontSize: 13, color: t.danger, marginBottom: 16 }}>
            {error}
          </Text>
        ) : null}

        <Pressable
          onPress={handleSave}
          disabled={!canSave || saving}
          style={{
            backgroundColor: t.primary,
            borderRadius: 12,
            height: 52,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: !canSave || saving ? 0.4 : 1,
          }}
        >
          {saving ? (
            <ActivityIndicator color={t.textOnPrim} />
          ) : (
            <Text
              style={{
                fontSize: 16,
                fontWeight: '600',
                color: t.textOnPrim,
              }}
            >
              Update password
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
