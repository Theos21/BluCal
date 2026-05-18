import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Linking,
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
import { useAuth } from '../../lib/AuthContext';
import { addWeightEntry, setMacroTarget, upsertProfile } from '../../lib/db';
import Toast from '../../components/Toast';
import { useToast } from '../../lib/useToast';
import type { ActivityLevel, BiologicalSex, Goal, Pace } from '../../lib/types';
import {
  ageFromBirthday,
  calculateMacroTargets,
  type Targets,
} from '../../lib/macroCalculator';

const TOTAL_STEPS = 7;

type Sex = 'Male' | 'Female' | 'Other';
type IconName = keyof typeof Ionicons.glyphMap;
type StepCardData = {
  id: string;
  title: string;
  desc: string;
  icon: IconName;
};

const GOALS: readonly StepCardData[] = [
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

const ACTIVITY: readonly StepCardData[] = [
  {
    id: 'sedentary',
    title: 'Sedentary',
    desc: 'Little or no exercise',
    icon: 'bed-outline',
  },
  {
    id: 'lightly',
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
    id: 'very',
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

const DIET_OPTIONS = [
  'None',
  'Vegetarian',
  'Vegan',
  'Keto',
  'Paleo',
  'Gluten-free',
  'Dairy-free',
  'Halal',
  'Kosher',
];

type PaceOption = {
  id: Pace;
  title: string;
  desc: string;
  icon: IconName;
};

const LOSE_PACES: readonly PaceOption[] = [
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

const GAIN_PACES: readonly PaceOption[] = [
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

// ── Reusable subcomponents ───────────────────────────────────────────────────
function InputLabel({ children }: { children: string }) {
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
          marginBottom: 6,
        },
      ]}
    >
      {children}
    </Text>
  );
}

function TextField({
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
}) {
  const t = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={t.textTer}
      keyboardType={keyboardType}
      returnKeyType="done"
      style={[
        typo.body,
        {
          backgroundColor: t.surface2,
          borderRadius: radius.md,
          paddingHorizontal: 14,
          paddingVertical: 12,
          color: t.text,
        },
      ]}
    />
  );
}

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

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: radius.pill,
        backgroundColor: selected ? t.primarySoft : t.surface2,
        borderWidth: selected ? 1 : 0,
        borderColor: selected ? t.primary : 'transparent',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text
        style={[
          typo.subhead,
          { color: selected ? t.primary : t.textSec },
        ]}
      >
        {label}
      </Text>
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

function TargetsEditor({
  t,
  targets,
  onChange,
}: {
  t: Theme;
  targets: Targets;
  onChange: (next: Targets) => void;
}) {
  const row = (
    label: string,
    suffix: string,
    value: number,
    onChangeNum: (n: number) => void,
  ) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingVertical: 10,
      }}
    >
      <Text style={[typo.subhead, { color: t.text, flex: 1 }]}>{label}</Text>
      <TextInput
        value={value === 0 ? '' : String(value)}
        onChangeText={(v) => {
          const parsed = parseInt(v.replace(/[^0-9]/g, ''), 10);
          onChangeNum(Number.isFinite(parsed) ? parsed : 0);
        }}
        keyboardType="numeric"
        returnKeyType="done"
        placeholder="0"
        placeholderTextColor={t.textTer}
        style={[
          typo.body,
          {
            backgroundColor: t.surface2,
            borderRadius: radius.md,
            paddingHorizontal: 12,
            paddingVertical: 8,
            color: t.text,
            minWidth: 80,
            textAlign: 'right',
            fontVariant: ['tabular-nums'],
          },
        ]}
      />
      <Text
        style={[typo.subhead, { color: t.textTer, width: 24 }]}
      >
        {suffix}
      </Text>
    </View>
  );

  return (
    <View
      style={{
        backgroundColor: t.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: t.hairline,
        paddingHorizontal: space.lg,
        paddingVertical: space.sm,
      }}
    >
      {row('Calories', 'kcal', targets.calories, (n) =>
        onChange({ ...targets, calories: n }),
      )}
      <View style={{ height: 0.5, backgroundColor: t.hairline }} />
      {row('Protein', 'g', targets.protein_g, (n) =>
        onChange({ ...targets, protein_g: n }),
      )}
      <View style={{ height: 0.5, backgroundColor: t.hairline }} />
      {row('Carbs', 'g', targets.carbs_g, (n) =>
        onChange({ ...targets, carbs_g: n }),
      )}
      <View style={{ height: 0.5, backgroundColor: t.hairline }} />
      {row('Fat', 'g', targets.fat_g, (n) =>
        onChange({ ...targets, fat_g: n }),
      )}
    </View>
  );
}

function mapSexToDb(sex: Sex | null): BiologicalSex | null {
  if (!sex) return null;
  return sex.toLowerCase() as BiologicalSex;
}

function mapActivityToDb(id: string | null): ActivityLevel | null {
  switch (id) {
    case 'sedentary':
      return 'sedentary';
    case 'lightly':
      return 'light';
    case 'moderate':
      return 'moderate';
    case 'very':
      return 'very_active';
    case 'athlete':
      return 'athlete';
    default:
      return null;
  }
}

// ── Main screen ──────────────────────────────────────────────────────────────
export default function Onboarding() {
  const t = useTheme();
  const toast = useToast();
  const { user, profile, refreshProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const progressAnim = useRef(new Animated.Value(1 / TOTAL_STEPS)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: (step + 1) / TOTAL_STEPS,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [step, progressAnim]);

  // Step 7 entrance animations
  const checkmarkScale = useRef(new Animated.Value(0)).current;
  const checkmarkOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (step === TOTAL_STEPS - 1) {
      Animated.parallel([
        Animated.spring(checkmarkScale, {
          toValue: 1,
          tension: 100,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.timing(checkmarkOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 400,
        delay: 300,
        useNativeDriver: true,
      }).start();
    } else {
      checkmarkScale.setValue(0);
      checkmarkOpacity.setValue(0);
      contentOpacity.setValue(0);
    }
  }, [step, checkmarkScale, checkmarkOpacity, contentOpacity]);

  const [goal, setGoal] = useState<string | null>(null);
  const [name, setName] = useState(profile?.name ?? '');

  useEffect(() => {
    if (profile?.name && !name) setName(profile.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.name]);
  const [sex, setSex] = useState<Sex | null>(null);
  const [birthYear, setBirthYear] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [isMetric, setIsMetric] = useState(false);

  const birthday =
    birthYear && birthMonth && birthDay
      ? `${birthYear}-${birthMonth.padStart(2, '0')}-${birthDay.padStart(2, '0')}`
      : '';
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weight, setWeight] = useState('');
  const [goalWeight, setGoalWeight] = useState('');
  const [activity, setActivity] = useState<string | null>(null);
  const [diet, setDiet] = useState<Set<string>>(new Set());
  const [targets, setTargets] = useState<Targets>({
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    tdee: 0,
    weeklyChangeKg: 0,
  });
  const [isEditingTargets, setIsEditingTargets] = useState(false);
  const [pace, setPace] = useState<Pace>('moderate');

  // Recompute targets when the user enters Step 5 (or their inputs change
  // while on it). Manual edits made via the editor persist until the user
  // changes any underlying stat and re-enters this step.
  useEffect(() => {
    if (step !== 5) return;
    const weightKgVal = isMetric
      ? Number(weight)
      : Number(weight) * 0.453592;
    const heightCmVal = isMetric
      ? Number(heightCm)
      : Number(heightFt) * 30.48 + Number(heightIn) * 2.54;
    const ageVal = birthday ? ageFromBirthday(birthday) ?? 0 : 0;
    if (
      !Number.isFinite(weightKgVal) ||
      weightKgVal <= 0 ||
      !Number.isFinite(heightCmVal) ||
      heightCmVal <= 0 ||
      !Number.isFinite(ageVal) ||
      ageVal <= 0 ||
      !sex ||
      !activity ||
      !goal
    ) {
      return;
    }
    const activityDb = mapActivityToDb(activity) ?? 'moderate';
    setTargets(
      calculateMacroTargets(
        weightKgVal,
        heightCmVal,
        ageVal,
        sex,
        activityDb,
        goal,
        pace,
      ),
    );
  }, [step, isMetric, weight, heightCm, heightFt, heightIn, birthday, sex, activity, goal, pace]);

  const completeOnboarding = async () => {
    if (saving) return;
    if (!user) {
      router.replace('/(auth)/signup');
      return;
    }
    setSaving(true);
    try {
      const heightCmValue = isMetric
        ? Number(heightCm)
        : Number(heightFt) * 30.48 + Number(heightIn) * 2.54;
      const goalWeightKg = isMetric
        ? Number(goalWeight)
        : Number(goalWeight) * 0.453592;
      const weightKgValue = isMetric
        ? Number(weight)
        : Number(weight) * 0.453592;
      const profileData: Record<string, unknown> = {
        biological_sex: mapSexToDb(sex),
        birthday: birthday || null,
        height_cm: Number.isFinite(heightCmValue) ? heightCmValue : null,
        goal: (goal as Goal | null) ?? null,
        goal_weight_kg: Number.isFinite(goalWeightKg) ? goalWeightKg : null,
        activity_level: mapActivityToDb(activity),
        dietary_preferences: Array.from(diet),
        is_metric: isMetric,
        pace,
      };
      if (name.trim() && !profile?.name) {
        profileData.name = name.trim();
      }
      try {
        console.log(
          'Attempting upsert with:',
          JSON.stringify(profileData),
        );
        await upsertProfile(user.id, profileData);
        console.log('upsertProfile succeeded');
      } catch (e) {
        const supaError = e as {
          message?: string;
          code?: string;
          details?: string;
          hint?: string;
        };
        console.error(
          'upsertProfile failed:',
          JSON.stringify(e),
          supaError.message,
          supaError.code,
          supaError.details,
          supaError.hint,
        );
        throw e;
      }
      if (Number.isFinite(weightKgValue) && weightKgValue > 0) {
        await addWeightEntry({
          user_id: user.id,
          logged_at: new Date().toISOString(),
          weight_kg: weightKgValue,
          note: null,
        });
      }
      await setMacroTarget({
        user_id: user.id,
        calories: targets.calories,
        protein_g: targets.protein_g,
        carbs_g: targets.carbs_g,
        fat_g: targets.fat_g,
        is_custom: isEditingTargets,
        net_carbs: false,
        effective_date: new Date().toISOString().split('T')[0],
      });
      await refreshProfile();
      router.replace('/(tabs)');
    } catch {
      setSaving(false);
      Alert.alert('Error', 'Could not save your profile. Please try again.');
    }
  };

  const handleNext = () => {
    if (saving) return;
    if (step === TOTAL_STEPS - 1) {
      void completeOnboarding();
    } else {
      setStep((s) => s + 1);
    }
  };

  const handleBack = () => setStep((s) => Math.max(0, s - 1));

  const toggleDiet = (d: string) => {
    if (d === 'None') {
      setDiet((prev) => (prev.has('None') ? new Set() : new Set(['None'])));
      return;
    }
    setDiet((prev) => {
      const next = new Set(prev);
      next.delete('None');
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  };

  const goalDate = useMemo(() => {
    if (!targets.weeklyChangeKg || !weight || !goalWeight) return null;
    const currentKg = isMetric ? Number(weight) : Number(weight) * 0.453592;
    const goalKg = isMetric
      ? Number(goalWeight)
      : Number(goalWeight) * 0.453592;
    if (!Number.isFinite(currentKg) || !Number.isFinite(goalKg)) return null;
    const diffKg = Math.abs(goalKg - currentKg);
    if (diffKg < 0.5) return null;
    const weeks = Math.max(
      1,
      Math.round(diffKg / Math.abs(targets.weeklyChangeKg)),
    );
    const date = new Date();
    date.setDate(date.getDate() + weeks * 7);
    const months = Math.max(1, Math.round(weeks / 4.33));
    return { weeks, months, date };
  }, [targets.weeklyChangeKg, weight, goalWeight, isMetric]);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: t.bg }}
      edges={['top', 'left', 'right']}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Progress bar */}
        <View style={{ height: 4, backgroundColor: t.surface2 }}>
          <Animated.View
            style={{
              height: 4,
              backgroundColor: t.primary,
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            }}
          />
        </View>

        {/* Step content */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: space.xl,
            paddingTop: space.xl,
            paddingBottom: space.lg,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {step === 0 && (
            <View>
              <Text style={[typo.title1, { color: t.text }]}>
                What is your goal?
              </Text>
              <Text
                style={[
                  typo.subhead,
                  { color: t.textSec, marginTop: space.xs },
                ]}
              >
                We will build your plan around this.
              </Text>
              <View style={{ marginTop: space.xl, gap: space.md }}>
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
            </View>
          )}

          {step === 1 && (
            <View>
              <Text style={[typo.title1, { color: t.text }]}>
                Tell us about yourself
              </Text>

              {!profile?.name && (
                <View style={{ marginTop: space.xl }}>
                  <Text
                    style={[
                      typo.subhead,
                      { color: t.textSec, marginBottom: 6 },
                    ]}
                  >
                    Full name
                  </Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="John Smith"
                    placeholderTextColor={t.textTer}
                    textContentType="name"
                    autoCapitalize="words"
                    returnKeyType="next"
                    style={[
                      typo.body,
                      {
                        backgroundColor: t.surface2,
                        borderRadius: radius.lg,
                        paddingHorizontal: space.md,
                        paddingVertical: space.sm,
                        color: t.text,
                      },
                    ]}
                  />
                </View>
              )}

              <View style={{ marginTop: space.lg }}>
                <InputLabel>Biological sex</InputLabel>
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

              <View style={{ marginTop: space.lg }}>
                <InputLabel>Birthday</InputLabel>
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <View style={{ flex: 2 }}>
                    <Text
                      style={[
                        typo.caption1,
                        { color: t.textTer, marginBottom: 4 },
                      ]}
                    >
                      Year
                    </Text>
                    <TextInput
                      style={[
                        typo.body,
                        {
                          backgroundColor: t.surface2,
                          borderRadius: radius.lg,
                          padding: space.sm,
                          color: t.text,
                          textAlign: 'center',
                        },
                      ]}
                      placeholder="1990"
                      placeholderTextColor={t.textTer}
                      value={birthYear}
                      onChangeText={setBirthYear}
                      keyboardType="number-pad"
                      maxLength={4}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        typo.caption1,
                        { color: t.textTer, marginBottom: 4 },
                      ]}
                    >
                      Month
                    </Text>
                    <TextInput
                      style={[
                        typo.body,
                        {
                          backgroundColor: t.surface2,
                          borderRadius: radius.lg,
                          padding: space.sm,
                          color: t.text,
                          textAlign: 'center',
                        },
                      ]}
                      placeholder="05"
                      placeholderTextColor={t.textTer}
                      value={birthMonth}
                      onChangeText={setBirthMonth}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        typo.caption1,
                        { color: t.textTer, marginBottom: 4 },
                      ]}
                    >
                      Day
                    </Text>
                    <TextInput
                      style={[
                        typo.body,
                        {
                          backgroundColor: t.surface2,
                          borderRadius: radius.lg,
                          padding: space.sm,
                          color: t.text,
                          textAlign: 'center',
                        },
                      ]}
                      placeholder="15"
                      placeholderTextColor={t.textTer}
                      value={birthDay}
                      onChangeText={setBirthDay}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                  </View>
                </View>
              </View>

              {isMetric ? (
                <View style={{ marginTop: space.lg }}>
                  <InputLabel>Height (cm)</InputLabel>
                  <TextField
                    value={heightCm}
                    onChangeText={setHeightCm}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                </View>
              ) : (
                <View
                  style={{
                    marginTop: space.lg,
                    flexDirection: 'row',
                    gap: space.md,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <InputLabel>Height (ft)</InputLabel>
                    <TextField
                      value={heightFt}
                      onChangeText={setHeightFt}
                      placeholder="0"
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <InputLabel>Height (in)</InputLabel>
                    <TextField
                      value={heightIn}
                      onChangeText={setHeightIn}
                      placeholder="0"
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              )}

              <View style={{ marginTop: space.lg }}>
                <InputLabel>{`Weight (${isMetric ? 'kg' : 'lbs'})`}</InputLabel>
                <TextField
                  value={weight}
                  onChangeText={setWeight}
                  placeholder="0"
                  keyboardType="decimal-pad"
                />
              </View>

              <Pressable
                onPress={() => setIsMetric((m) => !m)}
                hitSlop={6}
                style={({ pressed }) => ({
                  alignSelf: 'flex-start',
                  marginTop: space.md,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Text style={[typo.footnote, { color: t.primary }]}>
                  {`Switch to ${isMetric ? 'imperial' : 'metric'}`}
                </Text>
              </Pressable>
            </View>
          )}

          {step === 2 && (
            <View>
              <Text style={[typo.title1, { color: t.text }]}>
                What is your goal weight?
              </Text>
              <View
                style={{
                  alignItems: 'center',
                  marginTop: space.xxxl,
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
                <Text
                  style={[
                    typo.footnote,
                    {
                      color: t.textTer,
                      marginTop: space.xl,
                      textAlign: 'center',
                      fontStyle: 'italic',
                    },
                  ]}
                >
                  We will never rush you. This is just for pacing.
                </Text>
              </View>
            </View>
          )}

          {step === 3 && (
            <View>
              <Text style={[typo.title1, { color: t.text }]}>
                How active are you?
              </Text>
              <View style={{ marginTop: space.xl, gap: space.md }}>
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
            </View>
          )}

          {step === 4 && (
            <View>
              <Text style={[typo.title1, { color: t.text }]}>
                Any dietary preferences?
              </Text>
              <Text
                style={[
                  typo.subhead,
                  { color: t.textSec, marginTop: space.xs },
                ]}
              >
                Select all that apply.
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: space.sm,
                  marginTop: space.xl,
                }}
              >
                {DIET_OPTIONS.map((d) => (
                  <Chip
                    key={d}
                    label={d}
                    selected={diet.has(d)}
                    onPress={() => toggleDiet(d)}
                  />
                ))}
              </View>
            </View>
          )}

          {step === 5 && (
            <View>
              <Text style={[typo.title1, { color: t.text }]}>
                Your daily targets
              </Text>
              <Text
                style={[
                  typo.subhead,
                  { color: t.textSec, marginTop: space.xs },
                ]}
              >
                Based on your goal and stats.
              </Text>
              <View style={{ marginTop: space.xl }}>
                {isEditingTargets ? (
                  <TargetsEditor
                    t={t}
                    targets={targets}
                    onChange={setTargets}
                  />
                ) : (
                  <TargetsSummary t={t} targets={targets} />
                )}
              </View>

              {(goal === 'lose_fat' || goal === 'build_muscle') && (
                <View style={{ marginTop: space.xl }}>
                  <Text style={[typo.subheadEm, { color: t.text }]}>
                    How fast do you want to progress?
                  </Text>
                  <Text
                    style={[
                      typo.footnote,
                      { color: t.textSec, marginTop: 2 },
                    ]}
                  >
                    {goal === 'lose_fat'
                      ? 'How aggressive should your calorie deficit be?'
                      : 'How fast do you want to gain muscle?'}
                  </Text>
                  <View style={{ marginTop: space.md, gap: space.sm }}>
                    {(goal === 'lose_fat' ? LOSE_PACES : GAIN_PACES).map((p) => (
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

                  {goalDate && (
                    <View
                      style={{
                        backgroundColor: t.primarySoft,
                        borderRadius: radius.lg,
                        padding: space.md,
                        marginTop: space.md,
                        alignItems: 'center',
                      }}
                    >
                      <Text
                        style={[
                          typo.caption1,
                          {
                            color: t.primary,
                            fontWeight: '600',
                            marginBottom: 4,
                          },
                        ]}
                      >
                        ESTIMATED GOAL DATE
                      </Text>
                      <Text
                        style={[
                          typo.title1,
                          {
                            color: t.primary,
                            fontWeight: '800',
                            letterSpacing: -1,
                          },
                        ]}
                      >
                        {goalDate.date.toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </Text>
                      <Text
                        style={[
                          typo.subhead,
                          { color: t.textSec, marginTop: 4 },
                        ]}
                      >
                        {`${goalDate.weeks} weeks (${goalDate.months} ${goalDate.months === 1 ? 'month' : 'months'}) from today`}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              <Text
                style={[
                  typo.footnote,
                  {
                    color: t.textTer,
                    textAlign: 'center',
                    marginTop: space.lg,
                  },
                ]}
              >
                These adapt over time based on your real data.
              </Text>
              <Pressable
                hitSlop={6}
                onPress={() => setIsEditingTargets((v) => !v)}
                style={({ pressed }) => ({
                  alignSelf: 'center',
                  marginTop: space.md,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Text style={[typo.subhead, { color: t.primary }]}>
                  {isEditingTargets ? 'Done' : 'Edit targets manually'}
                </Text>
              </Pressable>
            </View>
          )}

          {step === 6 && (
            <View style={{ alignItems: 'center' }}>
              <Animated.View
                style={{
                  transform: [{ scale: checkmarkScale }],
                  opacity: checkmarkOpacity,
                }}
              >
                <View
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    backgroundColor: t.successSoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons
                    name="checkmark-outline"
                    size={40}
                    color={t.success}
                  />
                </View>
              </Animated.View>
              <Animated.View
                style={{
                  alignSelf: 'stretch',
                  alignItems: 'center',
                  opacity: contentOpacity,
                }}
              >
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
                  You are all set!
                </Text>
                <Text
                  style={[
                    typo.title2,
                    {
                      color: t.textSec,
                      marginTop: space.sm,
                      textAlign: 'center',
                    },
                  ]}
                >
                  {`Welcome, ${name || 'there'}`}
                </Text>
                <View
                  style={{
                    marginTop: space.xl,
                    alignSelf: 'stretch',
                  }}
                >
                  <TargetsSummary t={t} targets={targets} />
                </View>
              </Animated.View>
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        <View
          style={{
            paddingHorizontal: space.lg,
            paddingTop: space.sm,
            paddingBottom: space.lg,
          }}
        >
          {step > 0 && (
            <Pressable
              onPress={handleBack}
              hitSlop={6}
              style={({ pressed }) => ({
                alignItems: 'center',
                marginBottom: space.md,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text style={[typo.subhead, { color: t.textSec }]}>Back</Text>
            </Pressable>
          )}
          <Pressable
            onPress={handleNext}
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
                {step === TOTAL_STEPS - 1 ? 'Go to BluCal' : 'Continue'}
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
