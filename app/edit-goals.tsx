import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
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
import {
  radius,
  space,
  type as typo,
  useTheme,
  type Theme,
} from '../lib/theme';
import Toast from '../components/Toast';
import { useToast } from '../lib/useToast';
import { useAuth } from '../lib/AuthContext';
import { getWeightEntries, setMacroTarget, updateProfile } from '../lib/db';
import {
  ageFromBirthday,
  calculateMacroTargets,
  type Targets,
} from '../lib/macroCalculator';
import type { ActivityLevel, Goal, Pace } from '../lib/types';

type IconName = keyof typeof Ionicons.glyphMap;

const GOALS: { id: Goal; title: string; desc: string; icon: IconName }[] = [
  {
    id: 'lose_fat',
    title: 'Lose fat',
    desc: 'Drop body fat steadily',
    icon: 'flame-outline',
  },
  {
    id: 'build_muscle',
    title: 'Build muscle',
    desc: 'Add lean mass',
    icon: 'barbell-outline',
  },
  {
    id: 'maintain',
    title: 'Maintain weight',
    desc: 'Hold your current weight',
    icon: 'checkmark-circle-outline',
  },
  {
    id: 'performance',
    title: 'Improve performance',
    desc: 'Fuel your training',
    icon: 'trending-up-outline',
  },
];

const ACTIVITY: {
  id: ActivityLevel;
  title: string;
  desc: string;
  icon: IconName;
}[] = [
  {
    id: 'sedentary',
    title: 'Sedentary',
    desc: 'Little or no exercise',
    icon: 'bed-outline',
  },
  {
    id: 'light',
    title: 'Lightly active',
    desc: '1 to 3 days per week',
    icon: 'walk-outline',
  },
  {
    id: 'moderate',
    title: 'Moderately active',
    desc: '3 to 5 days per week',
    icon: 'bicycle-outline',
  },
  {
    id: 'very_active',
    title: 'Very active',
    desc: '6 to 7 days per week',
    icon: 'fitness-outline',
  },
  {
    id: 'athlete',
    title: 'Athlete',
    desc: 'Training twice daily',
    icon: 'trophy-outline',
  },
];

const LOSE_PACES: { id: Pace; title: string; desc: string; icon: IconName }[] = [
  {
    id: 'slow',
    title: 'Slow',
    desc: '~0.25 lbs/week. Easier to maintain, minimal muscle loss.',
    icon: 'trending-down-outline',
  },
  {
    id: 'moderate',
    title: 'Moderate',
    desc: '~0.5 lbs/week. Balanced approach, recommended for most.',
    icon: 'speedometer-outline',
  },
  {
    id: 'aggressive',
    title: 'Aggressive',
    desc: '~1 lb/week. Faster results, requires more discipline.',
    icon: 'flame-outline',
  },
];

const GAIN_PACES: { id: Pace; title: string; desc: string; icon: IconName }[] = [
  {
    id: 'slow',
    title: 'Slow',
    desc: '~0.25 lbs/week gain. Cleaner bulk, less fat gain.',
    icon: 'trending-down-outline',
  },
  {
    id: 'moderate',
    title: 'Moderate',
    desc: '~0.5 lbs/week gain. Standard lean bulk.',
    icon: 'speedometer-outline',
  },
  {
    id: 'aggressive',
    title: 'Aggressive',
    desc: '~1 lb/week gain. Faster mass, expect some fat gain.',
    icon: 'flame-outline',
  },
];

function SelectableCard({
  icon,
  title,
  desc,
  selected,
  onPress,
}: {
  icon: IconName;
  title: string;
  desc: string;
  selected: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: selected ? t.primarySoft : t.surface,
        borderRadius: radius.lg,
        borderWidth: selected ? 1.5 : 1,
        borderColor: selected ? t.primary : t.hairline,
        padding: space.lg,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Ionicons name={icon} size={24} color={t.primary} />
      <View style={{ flex: 1 }}>
        <Text
          style={[
            typo.subheadEm,
            { color: selected ? t.primary : t.text },
          ]}
        >
          {title}
        </Text>
        <Text style={[typo.footnote, { color: t.textSec, marginTop: 2 }]}>
          {desc}
        </Text>
      </View>
    </Pressable>
  );
}

function MacroRow({
  label,
  grams,
  color,
  t,
}: {
  label: string;
  grams: number;
  color: string;
  t: Theme;
}) {
  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'baseline',
        }}
      >
        <Text style={[typo.subhead, { color: t.text }]}>{label}</Text>
        <Text style={[typo.subheadEm, { color: t.text }]}>
          {`${grams}g`}
        </Text>
      </View>
      <View
        style={{
          height: 4,
          backgroundColor: t.surface2,
          borderRadius: radius.pill,
          marginTop: 4,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            height: '100%',
            width: '100%',
            backgroundColor: color,
            borderRadius: radius.pill,
          }}
        />
      </View>
    </View>
  );
}

function TargetsSummary({ t, targets }: { t: Theme; targets: Targets }) {
  return (
    <View
      style={{
        backgroundColor: t.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: t.hairline,
        padding: space.lg,
      }}
    >
      <Text
        style={[
          typo.caption2,
          {
            color: t.textTer,
            letterSpacing: 0.06,
            textTransform: 'uppercase',
            fontWeight: '700',
            textAlign: 'center',
          },
        ]}
      >
        Calories
      </Text>
      <Text
        style={[
          typo.largeTitle,
          {
            color: t.text,
            textAlign: 'center',
            marginTop: 4,
            fontVariant: ['tabular-nums'],
          },
        ]}
      >
        {targets.calories.toLocaleString()}
      </Text>
      <View style={{ marginTop: space.lg, gap: space.md }}>
        <MacroRow label="Protein" grams={targets.protein_g} color={t.protein} t={t} />
        <MacroRow label="Carbs" grams={targets.carbs_g} color={t.carbs} t={t} />
        <MacroRow label="Fat" grams={targets.fat_g} color={t.fat} t={t} />
      </View>
    </View>
  );
}

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

export default function EditGoals() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { user, profile, refreshProfile } = useAuth();

  const [goal, setGoal] = useState<Goal | null>(null);
  const [goalWeight, setGoalWeight] = useState('');
  const [isMetric, setIsMetric] = useState(false);
  const [pace, setPace] = useState<Pace>('moderate');
  const [activity, setActivity] = useState<ActivityLevel | null>(null);
  const [latestWeightKg, setLatestWeightKg] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setGoal(profile.goal);
    setIsMetric(profile.is_metric);
    setPace(profile.pace);
    setActivity(profile.activity_level);
    if (profile.goal_weight_kg !== null && profile.goal_weight_kg !== undefined) {
      setGoalWeight(
        profile.is_metric
          ? profile.goal_weight_kg.toFixed(1)
          : (profile.goal_weight_kg * 2.20462).toFixed(1),
      );
    }
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    getWeightEntries(user.id, 1)
      .then((entries) => {
        if (entries.length > 0) setLatestWeightKg(Number(entries[0].weight_kg));
      })
      .catch(console.error);
  }, [user]);

  const targets = useMemo<Targets | null>(() => {
    if (!profile || !goal || !activity) return null;
    const age = ageFromBirthday(profile.birthday) ?? 30;
    const weightKg = latestWeightKg ?? profile.goal_weight_kg ?? 70;
    const heightCm = profile.height_cm ?? 170;
    const sex = profile.biological_sex ?? 'male';
    return calculateMacroTargets(
      weightKg,
      heightCm,
      age,
      sex,
      activity,
      goal,
      pace,
    );
  }, [profile, goal, activity, pace, latestWeightKg]);

  const handleSave = async () => {
    if (!user || saving || !goal || !activity || !targets) return;
    setSaving(true);
    try {
      const goalWeightKg = goalWeight
        ? isMetric
          ? Number(goalWeight)
          : Number(goalWeight) * 0.453592
        : null;
      await updateProfile(user.id, {
        goal,
        goal_weight_kg:
          goalWeightKg !== null && Number.isFinite(goalWeightKg)
            ? goalWeightKg
            : null,
        pace,
        activity_level: activity,
      });
      await setMacroTarget({
        user_id: user.id,
        calories: targets.calories,
        protein_g: targets.protein_g,
        carbs_g: targets.carbs_g,
        fat_g: targets.fat_g,
        is_custom: false,
        net_carbs: false,
        effective_date: new Date().toISOString().split('T')[0],
      });
      await refreshProfile();
      router.back();
    } catch {
      setSaving(false);
      toast.show('Could not save goals. Try again.', 'error');
    }
  };

  const showPace = goal === 'lose_fat' || goal === 'build_muscle';
  const paceCards = goal === 'build_muscle' ? GAIN_PACES : LOSE_PACES;

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
            Edit goals
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
          <SectionLabel label="Your goal" />
          <View style={{ marginHorizontal: space.lg, gap: space.sm }}>
            {GOALS.map((g) => (
              <SelectableCard
                key={g.id}
                icon={g.icon}
                title={g.title}
                desc={g.desc}
                selected={goal === g.id}
                onPress={() => setGoal(g.id)}
              />
            ))}
          </View>

          <SectionLabel label="Goal weight" />
          <View
            style={{
              alignItems: 'center',
              marginHorizontal: space.lg,
              backgroundColor: t.surface,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: t.hairline,
              paddingVertical: space.xl,
            }}
          >
            <TextInput
              value={goalWeight}
              onChangeText={setGoalWeight}
              placeholder="0"
              placeholderTextColor={t.textTer}
              keyboardType="decimal-pad"
              returnKeyType="done"
              style={[
                typo.largeTitle,
                {
                  color: t.text,
                  textAlign: 'center',
                  minWidth: 140,
                  borderBottomWidth: 2,
                  borderBottomColor: t.primary,
                  paddingVertical: 8,
                  fontVariant: ['tabular-nums'],
                },
              ]}
            />
            <Text
              style={[
                typo.subhead,
                { color: t.textSec, marginTop: space.sm },
              ]}
            >
              {isMetric ? 'kg' : 'lbs'}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'center',
                gap: space.sm,
                marginTop: space.md,
              }}
            >
              {(['lbs', 'kg'] as const).map((u) => {
                const sel = isMetric === (u === 'kg');
                return (
                  <Pressable
                    key={u}
                    onPress={() => {
                      const nextMetric = u === 'kg';
                      if (nextMetric === isMetric) return;
                      const num = Number(goalWeight);
                      if (Number.isFinite(num) && num > 0) {
                        setGoalWeight(
                          nextMetric
                            ? (num * 0.453592).toFixed(1)
                            : (num * 2.20462).toFixed(1),
                        );
                      }
                      setIsMetric(nextMetric);
                    }}
                    style={({ pressed }) => ({
                      backgroundColor: sel ? t.primary : t.surface2,
                      borderRadius: radius.pill,
                      paddingHorizontal: 12,
                      paddingVertical: 4,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text
                      style={[
                        typo.caption1,
                        {
                          color: sel ? t.textOnPrim : t.textSec,
                          fontWeight: '600',
                        },
                      ]}
                    >
                      {u}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {showPace && (
            <>
              <SectionLabel label="Pace" />
              <View style={{ marginHorizontal: space.lg, gap: space.sm }}>
                {paceCards.map((p) => (
                  <SelectableCard
                    key={p.id}
                    icon={p.icon}
                    title={p.title}
                    desc={p.desc}
                    selected={pace === p.id}
                    onPress={() => setPace(p.id)}
                  />
                ))}
              </View>
            </>
          )}

          <SectionLabel label="Activity level" />
          <View style={{ marginHorizontal: space.lg, gap: space.sm }}>
            {ACTIVITY.map((a) => (
              <SelectableCard
                key={a.id}
                icon={a.icon}
                title={a.title}
                desc={a.desc}
                selected={activity === a.id}
                onPress={() => setActivity(a.id)}
              />
            ))}
          </View>

          {targets && (
            <>
              <SectionLabel label="New targets" />
              <View style={{ marginHorizontal: space.lg }}>
                <TargetsSummary t={t} targets={targets} />
              </View>
            </>
          )}
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
            disabled={saving || !goal || !activity || !targets}
            style={({ pressed }) => ({
              height: 52,
              borderRadius: radius.lg,
              backgroundColor: t.primary,
              alignItems: 'center',
              justifyContent: 'center',
              opacity:
                saving || !goal || !activity || !targets
                  ? 0.4
                  : pressed
                    ? 0.85
                    : 1,
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
