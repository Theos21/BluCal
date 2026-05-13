import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { radius, space, type as typo, useTheme, type Theme } from '../lib/theme';
import Toast from '../components/Toast';
import { useToast } from '../lib/useToast';
import { sessionState } from '../lib/sessionState';
import { useAuth } from '../lib/AuthContext';
import { addFeelingEntry } from '../lib/db';

type Variant = 'primary' | 'teal' | 'warn';

const HUNGER = ['Starving', 'Hungry', 'Neutral', 'Satisfied', 'Full'];
const ENERGY = ['Exhausted', 'Tired', 'Okay', 'Good', 'Great'];
const MOOD = ['Stressed', 'Low', 'Okay', 'Good', 'Great'];

function formatTime(d: Date): string {
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 === 0 ? 12 : h % 12;
  return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function variantColors(t: Theme, v: Variant): { soft: string; main: string } {
  switch (v) {
    case 'primary':
      return { soft: t.primarySoft, main: t.primary };
    case 'teal':
      return { soft: t.tealSoft, main: t.teal };
    case 'warn':
      return { soft: t.warnSoft, main: t.warn };
  }
}

function RatingPill({
  label,
  selected,
  variant,
  onPress,
}: {
  label: string;
  selected: boolean;
  variant: Variant;
  onPress: () => void;
}) {
  const t = useTheme();
  const c = variantColors(t, variant);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: selected ? c.soft : t.surface2,
        borderRadius: radius.pill,
        borderWidth: selected ? 1 : 0,
        borderColor: selected ? c.main : 'transparent',
        paddingHorizontal: 14,
        paddingVertical: 8,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text
        style={[
          typo.footnote,
          {
            color: selected ? c.main : t.textSec,
            fontWeight: selected ? '600' : '400',
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function OptionalBadge() {
  const t = useTheme();
  return (
    <View
      style={{
        marginLeft: space.sm,
        backgroundColor: t.surface2,
        borderRadius: radius.pill,
        paddingHorizontal: 8,
        paddingVertical: 2,
      }}
    >
      <Text style={[typo.caption2, { color: t.textTer }]}>Optional</Text>
    </View>
  );
}

function RatingSection({
  title,
  subtitle,
  optional,
  options,
  value,
  onChange,
  variant,
}: {
  title: string;
  subtitle?: string;
  optional?: boolean;
  options: string[];
  value: number | null;
  onChange: (v: number) => void;
  variant: Variant;
}) {
  const t = useTheme();
  return (
    <View style={{ paddingVertical: space.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={[typo.subheadEm, { color: t.text }]}>{title}</Text>
        {optional && <OptionalBadge />}
      </View>
      {subtitle && (
        <Text
          style={[typo.footnote, { color: t.textSec, marginTop: 2 }]}
        >
          {subtitle}
        </Text>
      )}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 6,
          marginTop: space.md,
        }}
      >
        {options.map((opt, i) => (
          <RatingPill
            key={opt}
            label={opt}
            selected={value === i + 1}
            variant={variant}
            onPress={() => onChange(i + 1)}
          />
        ))}
      </View>
    </View>
  );
}

function Separator() {
  const t = useTheme();
  return <View style={{ height: 0.5, backgroundColor: t.hairline }} />;
}

export default function Feeling() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [hunger, setHunger] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [mood, setMood] = useState<number | null>(null);
  const [time] = useState(formatTime(new Date()));
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const hasAny = hunger !== null || energy !== null || mood !== null;

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await addFeelingEntry({
        user_id: user.id,
        logged_at: new Date().toISOString(),
        hunger: hunger ?? null,
        energy: energy ?? null,
        mood: mood ?? null,
      });
      sessionState.setFeelingDismissed(true);
      toast.show('Feeling logged', 'success');
      setTimeout(() => router.back(), 800);
    } catch {
      toast.show('Could not save. Try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    sessionState.setFeelingDismissed(true);
    router.back();
  };

  const handlePrimary = () => {
    if (saving) return;
    if (hasAny) {
      void handleSave();
    } else {
      handleSkip();
    }
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: t.bg }}
      edges={['top', 'left', 'right']}
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
            { color: t.text, textAlign: 'center', marginTop: 12 },
          ]}
        >
          How are you feeling?
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
        contentContainerStyle={{
          paddingHorizontal: space.xl,
          paddingTop: space.md,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <RatingSection
          title="How hungry are you?"
          subtitle="Right now, before eating"
          options={HUNGER}
          value={hunger}
          onChange={setHunger}
          variant="primary"
        />

        <Separator />

        <RatingSection
          title="Energy level"
          subtitle="How energized do you feel?"
          options={ENERGY}
          value={energy}
          onChange={setEnergy}
          variant="teal"
        />

        <Separator />

        <RatingSection
          title="Mood"
          optional
          options={MOOD}
          value={mood}
          onChange={setMood}
          variant="warn"
        />

        <Separator />

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 14,
          }}
        >
          <Text style={[typo.subhead, { color: t.textSec }]}>Time</Text>
          <Text style={[typo.subhead, { color: t.text }]}>{time}</Text>
        </View>
      </ScrollView>

      {/* Save / Skip */}
      <View
        style={{
          paddingHorizontal: space.xl,
          paddingTop: space.sm,
          paddingBottom: insets.bottom + space.md,
        }}
      >
        <Pressable
          onPress={handlePrimary}
          disabled={saving}
          style={({ pressed }) => ({
            height: 52,
            borderRadius: radius.lg,
            backgroundColor: hasAny ? t.primary : t.surface2,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: saving ? 0.6 : pressed ? 0.85 : 1,
          })}
        >
          {saving ? (
            <ActivityIndicator color={t.textOnPrim} />
          ) : (
            <Text
              style={[
                typo.headline,
                { color: hasAny ? t.textOnPrim : t.text },
              ]}
            >
              {hasAny ? 'Save' : 'Skip'}
            </Text>
          )}
        </Pressable>
      </View>
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
