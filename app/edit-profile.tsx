import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { radius, space, type as typo, useTheme } from '../lib/theme';
import Toast from '../components/Toast';
import { useToast } from '../lib/useToast';
import { useAuth } from '../lib/AuthContext';
import { updateProfile } from '../lib/db';
import type { BiologicalSex } from '../lib/types';

type Sex = 'Male' | 'Female' | 'Other';

const sexToDb = (s: Sex): BiologicalSex =>
  s.toLowerCase() as BiologicalSex;
const sexFromDb = (s: BiologicalSex | null | undefined): Sex | null => {
  if (!s) return null;
  return (s.charAt(0).toUpperCase() + s.slice(1)) as Sex;
};

function SectionLabel({ label }: { label: string }) {
  const t = useTheme();
  return (
    <Text
      style={[
        typo.caption2,
        {
          color: t.textTer,
          letterSpacing: 0.06,
          textTransform: 'uppercase',
          fontWeight: '700',
          paddingHorizontal: space.lg,
          paddingTop: space.xl,
          paddingBottom: space.xs,
        },
      ]}
    >
      {label}
    </Text>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View
      style={{
        backgroundColor: t.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: t.hairline,
        marginHorizontal: space.lg,
        overflow: 'hidden',
      }}
    >
      {children}
    </View>
  );
}

function Divider() {
  const t = useTheme();
  return (
    <View
      style={{
        height: 0.5,
        backgroundColor: t.hairline,
        marginLeft: space.lg,
      }}
    />
  );
}

export default function EditProfile() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { user, profile, refreshProfile } = useAuth();

  const [name, setName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [isMetric, setIsMetric] = useState(false);
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setName(profile.name ?? '');
    setBirthday(profile.birthday ?? '');
    setSex(sexFromDb(profile.biological_sex));
    setIsMetric(profile.is_metric);
    if (profile.height_cm !== null && profile.height_cm !== undefined) {
      if (profile.is_metric) {
        setHeightCm(String(Math.round(profile.height_cm)));
      } else {
        const totalIn = profile.height_cm / 2.54;
        const ft = Math.floor(totalIn / 12);
        const inches = Math.round(totalIn - ft * 12);
        setHeightFt(String(ft));
        setHeightIn(String(inches));
      }
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user || saving) return;
    setSaving(true);
    try {
      const heightCmValue = isMetric
        ? Number(heightCm)
        : Number(heightFt) * 30.48 + Number(heightIn) * 2.54;
      await updateProfile(user.id, {
        name: name.trim() || null,
        birthday: birthday.trim() || null,
        biological_sex: sex ? sexToDb(sex) : null,
        height_cm:
          Number.isFinite(heightCmValue) && heightCmValue > 0
            ? heightCmValue
            : null,
        is_metric: isMetric,
      });
      await refreshProfile();
      router.back();
    } catch {
      setSaving(false);
      toast.show('Could not save profile. Try again.', 'error');
    }
  };

  const email = profile?.email ?? user?.email ?? '';

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: t.bg }}
      edges={['top', 'left', 'right']}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View>
          <View style={{ alignItems: 'center' }}>
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: radius.pill,
                backgroundColor: t.surface3,
                marginTop: 8,
              }}
            />
          </View>
          <Text
            style={[
              typo.title3,
              {
                color: t.text,
                textAlign: 'center',
                marginTop: 12,
              },
            ]}
          >
            Edit profile
          </Text>
          <Pressable
            onPress={() => router.back()}
            hitSlop={6}
            style={({ pressed }) => ({
              position: 'absolute',
              top: 16,
              right: 16,
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: t.surface2,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Ionicons name="close-outline" size={18} color={t.textSec} />
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: space.xl }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <SectionLabel label="Personal info" />
          <Section>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: space.lg,
                paddingVertical: 12,
                minHeight: 48,
                gap: space.md,
              }}
            >
              <Text style={[typo.subhead, { color: t.textSec }]}>Full name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={t.textTer}
                autoCapitalize="words"
                returnKeyType="done"
                style={[
                  typo.subhead,
                  {
                    flex: 1,
                    color: t.text,
                    textAlign: 'right',
                    padding: 0,
                  },
                ]}
              />
            </View>
            <Divider />
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: space.lg,
                paddingVertical: 12,
                minHeight: 48,
              }}
            >
              <Text style={[typo.subhead, { color: t.textSec, flex: 1 }]}>
                Email
              </Text>
              <Text
                style={[typo.subhead, { color: t.textTer }]}
                numberOfLines={1}
              >
                {email}
              </Text>
            </View>
            <Divider />
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: space.lg,
                paddingVertical: 12,
                minHeight: 48,
                gap: space.md,
              }}
            >
              <Text style={[typo.subhead, { color: t.textSec }]}>Birthday</Text>
              <TextInput
                value={birthday}
                onChangeText={setBirthday}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={t.textTer}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                style={[
                  typo.subhead,
                  {
                    flex: 1,
                    color: t.text,
                    textAlign: 'right',
                    padding: 0,
                  },
                ]}
              />
            </View>
            <Divider />
            <View
              style={{
                paddingHorizontal: space.lg,
                paddingVertical: 12,
              }}
            >
              <Text
                style={[
                  typo.subhead,
                  { color: t.textSec, marginBottom: space.sm },
                ]}
              >
                Biological sex
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  backgroundColor: t.surface2,
                  borderRadius: radius.lg,
                  padding: 3,
                }}
              >
                {(['Male', 'Female', 'Other'] as Sex[]).map((opt) => {
                  const sel = sex === opt;
                  return (
                    <Pressable
                      key={opt}
                      onPress={() => setSex(opt)}
                      style={({ pressed }) => ({
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: radius.md,
                        backgroundColor: sel ? t.surface : 'transparent',
                        alignItems: 'center',
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <Text
                        style={[
                          typo.subheadEm,
                          { color: sel ? t.text : t.textTer },
                        ]}
                      >
                        {opt}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </Section>

          <SectionLabel label="Body stats" />
          <Section>
            <View
              style={{
                paddingHorizontal: space.lg,
                paddingVertical: 12,
              }}
            >
              <Text
                style={[
                  typo.subhead,
                  { color: t.textSec, marginBottom: space.sm },
                ]}
              >
                Height
              </Text>
              {isMetric ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  <TextInput
                    value={heightCm}
                    onChangeText={setHeightCm}
                    placeholder="0"
                    placeholderTextColor={t.textTer}
                    keyboardType="numeric"
                    returnKeyType="done"
                    style={[
                      typo.body,
                      {
                        flex: 1,
                        backgroundColor: t.surface2,
                        borderRadius: radius.md,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        color: t.text,
                        textAlign: 'right',
                        fontVariant: ['tabular-nums'],
                      },
                    ]}
                  />
                  <Text style={[typo.subhead, { color: t.textSec, width: 28 }]}>
                    cm
                  </Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
                  <TextInput
                    value={heightFt}
                    onChangeText={setHeightFt}
                    placeholder="0"
                    placeholderTextColor={t.textTer}
                    keyboardType="numeric"
                    returnKeyType="done"
                    style={[
                      typo.body,
                      {
                        flex: 1,
                        backgroundColor: t.surface2,
                        borderRadius: radius.md,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        color: t.text,
                        textAlign: 'right',
                        fontVariant: ['tabular-nums'],
                      },
                    ]}
                  />
                  <Text style={[typo.subhead, { color: t.textSec, width: 20 }]}>
                    ft
                  </Text>
                  <TextInput
                    value={heightIn}
                    onChangeText={setHeightIn}
                    placeholder="0"
                    placeholderTextColor={t.textTer}
                    keyboardType="numeric"
                    returnKeyType="done"
                    style={[
                      typo.body,
                      {
                        flex: 1,
                        backgroundColor: t.surface2,
                        borderRadius: radius.md,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        color: t.text,
                        textAlign: 'right',
                        fontVariant: ['tabular-nums'],
                      },
                    ]}
                  />
                  <Text style={[typo.subhead, { color: t.textSec, width: 20 }]}>
                    in
                  </Text>
                </View>
              )}
            </View>
            <Divider />
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: space.lg,
                paddingVertical: 12,
                minHeight: 48,
              }}
            >
              <Text style={[typo.subhead, { color: t.textSec, flex: 1 }]}>
                Units
              </Text>
              <Text
                style={[
                  typo.subhead,
                  { color: t.textSec, marginRight: space.sm },
                ]}
              >
                {isMetric ? 'Metric' : 'Imperial'}
              </Text>
              <Switch
                value={isMetric}
                onValueChange={setIsMetric}
                trackColor={{ false: t.surface3, true: t.primary }}
              />
            </View>
          </Section>
        </ScrollView>

        <View
          style={{
            paddingHorizontal: space.lg,
            paddingTop: space.sm,
            paddingBottom: insets.bottom + space.md,
          }}
        >
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={({ pressed }) => ({
              height: 52,
              borderRadius: radius.lg,
              backgroundColor: t.primary,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: saving ? 0.6 : pressed ? 0.85 : 1,
            })}
          >
            {saving ? (
              <ActivityIndicator color={t.textOnPrim} />
            ) : (
              <Text style={[typo.headline, { color: t.textOnPrim }]}>
                Save
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      <Toast
        message={toast.message}
        visible={toast.visible}
        type={toast.type}
        duration={toast.duration}
        onHide={toast.hide}
      />
    </SafeAreaView>
  );
}
