import { useEffect, useMemo, useState } from 'react';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Svg, { Circle, G } from 'react-native-svg';
import { radius, space, type as typo, useTheme, type Theme } from '../lib/theme';
import Toast from '../components/Toast';
import { useToast } from '../lib/useToast';
import { useAuth } from '../lib/AuthContext';
import { getWeightEntries, setMacroTarget, updateProfile } from '../lib/db';
import type { Pace } from '../lib/types';
import {
  ageFromBirthday,
  calculateMacroTargets,
  type Targets,
} from '../lib/macroCalculator';

type Mode = 'recommended' | 'custom';

type PaceOption = {
  id: Pace;
  title: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
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

// Fallback baseline when the user's profile is missing fields needed to
// compute personalised targets. Matches the prior hardcoded numbers.
const FALLBACK_TARGETS: Targets = {
  calories: 2000,
  protein_g: 160,
  carbs_g: 220,
  fat_g: 65,
  tdee: 2000,
  weeklyChangeKg: 0,
};

const PROTEIN_KCAL = 4;
const CARBS_KCAL = 4;
const FAT_KCAL = 9;

function safeNum(s: string): number {
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

// ── Recommended-mode macro bar ───────────────────────────────────────────────
function MacroBar({
  label,
  grams,
  color,
  pct,
  t,
}: {
  label: string;
  grams: number;
  color: string;
  pct: number;
  t: Theme;
}) {
  return (
    <View style={{ marginBottom: space.md }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 4,
        }}
      >
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: color,
          }}
        />
        <Text
          style={[
            typo.subheadEm,
            { color: t.text, flex: 1, marginLeft: 8 },
          ]}
        >
          {label}
        </Text>
        <Text style={[typo.subhead, { color: t.textSec }]}>
          {`${grams}g`}
        </Text>
        <Text
          style={[
            typo.caption1,
            { color: t.textTer, marginLeft: 8, minWidth: 32, textAlign: 'right' },
          ]}
        >
          {`${pct}%`}
        </Text>
      </View>
      <View
        style={{
          height: 4,
          backgroundColor: t.surface2,
          borderRadius: radius.pill,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            height: '100%',
            width: `${Math.max(0, Math.min(100, pct))}%`,
            backgroundColor: color,
            borderRadius: radius.pill,
          }}
        />
      </View>
    </View>
  );
}

// ── Custom-mode donut ────────────────────────────────────────────────────────
function MacroDonut({
  pCal,
  cCal,
  fCal,
  calNum,
  centerLabel,
  t,
}: {
  pCal: number;
  cCal: number;
  fCal: number;
  calNum: number;
  centerLabel: string;
  t: Theme;
}) {
  const size = 160;
  const stroke = 16;
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;

  // Each arc is sized as a share of the calorie target (not of summed macros),
  // so an under-allocated plan leaves a visible gray gap. Each is capped at
  // the full circumference so a single macro can't overflow visually.
  const pArc = calNum > 0 ? Math.min((pCal / calNum) * circ, circ) : 0;
  const cArc = calNum > 0 ? Math.min((cCal / calNum) * circ, circ) : 0;
  const fArc = calNum > 0 ? Math.min((fCal / calNum) * circ, circ) : 0;

  const arcs =
    calNum > 0
      ? [
          { color: t.protein, len: pArc },
          { color: t.carbs, len: cArc },
          { color: t.teal, len: fArc },
        ]
      : [];

  let offset = 0;

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Svg
        width={size}
        height={size}
        style={{ position: 'absolute' }}
      >
        <G rotation={-90} originX={cx} originY={cy}>
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            stroke={t.surface2}
            strokeWidth={stroke}
            fill="none"
          />
          {arcs.map((arc, i) => {
            const el = (
              <Circle
                key={i}
                cx={cx}
                cy={cy}
                r={r}
                stroke={arc.color}
                strokeWidth={stroke}
                fill="none"
                strokeDasharray={`${arc.len} ${circ - arc.len}`}
                strokeDashoffset={-offset}
              />
            );
            offset += arc.len;
            return el;
          })}
        </G>
      </Svg>
      <View style={{ alignItems: 'center' }}>
        <Text
          style={[
            typo.headline,
            { color: t.text, fontVariant: ['tabular-nums'] },
          ]}
        >
          {centerLabel}
        </Text>
        <Text style={[typo.caption2, { color: t.textTer, marginTop: 2 }]}>
          kcal
        </Text>
      </View>
    </View>
  );
}

// ── Custom-mode macro input row ──────────────────────────────────────────────
function MacroInputRow({
  label,
  value,
  onChange,
  color,
  pct,
  t,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  color: string;
  pct: number;
  t: Theme;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        marginTop: space.md,
      }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: color,
        }}
      />
      <Text style={[typo.subheadEm, { color: t.text, flex: 1 }]}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="numeric"
        returnKeyType="done"
        selectTextOnFocus
        style={[
          typo.title2,
          {
            width: 80,
            backgroundColor: t.surface2,
            borderRadius: radius.lg,
            paddingHorizontal: space.lg,
            paddingVertical: space.sm,
            color: t.text,
            textAlign: 'center',
          },
        ]}
      />
      <Text style={[typo.subhead, { color: t.textSec }]}>g</Text>
      <Text
        style={[
          typo.caption1,
          {
            color: t.textTer,
            minWidth: 36,
            textAlign: 'right',
            fontVariant: ['tabular-nums'],
          },
        ]}
      >
        {`${pct}%`}
      </Text>
    </View>
  );
}

function PaceCard({
  icon,
  title,
  desc,
  selected,
  onPress,
  t,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  desc: string;
  selected: boolean;
  onPress: () => void;
  t: Theme;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: selected ? t.primarySoft : t.surface,
        borderRadius: radius.lg,
        borderWidth: selected ? 1.5 : 1,
        borderColor: selected ? t.primary : t.hairline,
        padding: space.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Ionicons name={icon} size={22} color={t.primary} />
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

function ProjectionCard({
  t,
  goal,
  currentWeightKg,
  goalWeightKg,
  isMetric,
  weeklyChangeKg,
}: {
  t: Theme;
  goal: string | null;
  currentWeightKg: number | null;
  goalWeightKg: number | null;
  isMetric: boolean;
  weeklyChangeKg: number;
}) {
  if (goal !== 'lose_fat' && goal !== 'build_muscle') return null;

  let body: string;
  let bodyColor: string;
  const unit = isMetric ? 'kg' : 'lbs';

  if (
    currentWeightKg === null ||
    goalWeightKg === null ||
    !Number.isFinite(currentWeightKg) ||
    !Number.isFinite(goalWeightKg)
  ) {
    body = 'Set a goal weight on your profile to see your projection.';
    bodyColor = t.textTer;
  } else {
    const diffKg = Math.abs(goalWeightKg - currentWeightKg);
    const absWeekly = Math.abs(weeklyChangeKg);
    if (absWeekly === 0 || diffKg === 0) {
      body = 'Set a goal weight on your profile to see your projection.';
      bodyColor = t.textTer;
    } else {
      const weeks = Math.max(1, Math.round(diffKg / absWeekly));
      const months = (weeks / 4.33).toFixed(1);
      const displayWeight = isMetric
        ? goalWeightKg.toFixed(1)
        : (goalWeightKg / 0.453592).toFixed(1);
      body = `At this pace you will reach ${displayWeight} ${unit} in approximately ${weeks} weeks (${months} months).`;
      bodyColor = t.textSec;
    }
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: space.sm,
        backgroundColor: t.surface2,
        borderRadius: radius.lg,
        paddingHorizontal: space.lg,
        paddingVertical: space.md,
        marginTop: space.md,
      }}
    >
      <Ionicons
        name="calendar-outline"
        size={16}
        color={t.textSec}
        style={{ marginTop: 2 }}
      />
      <Text style={[typo.footnote, { color: bodyColor, flex: 1 }]}>
        {body}
      </Text>
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────
export default function EditMacros() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { user, profile, refreshProfile } = useAuth();

  const [currentWeightKg, setCurrentWeightKg] = useState<number | null>(null);
  const [weightLoaded, setWeightLoaded] = useState(false);
  const [pace, setPace] = useState<Pace>(profile?.pace ?? 'moderate');

  // Reset pace state if the profile loads after mount.
  useEffect(() => {
    if (profile?.pace) setPace(profile.pace);
  }, [profile?.pace]);

  // Load the latest weight entry so we can compute recommended targets and
  // a projection. If none exists, fall back to nulls.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user) {
        setWeightLoaded(true);
        return;
      }
      try {
        const entries = await getWeightEntries(user.id, 365);
        if (cancelled) return;
        if (entries.length > 0) {
          setCurrentWeightKg(entries[entries.length - 1].weight_kg);
        }
      } catch {
        // ignore; we'll fall back to placeholder targets
      } finally {
        if (!cancelled) setWeightLoaded(true);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const age = ageFromBirthday(profile?.birthday);
  const computedTargets = useMemo<Targets>(() => {
    if (
      !profile ||
      currentWeightKg === null ||
      !profile.height_cm ||
      !age ||
      !profile.biological_sex ||
      !profile.activity_level ||
      !profile.goal
    ) {
      return FALLBACK_TARGETS;
    }
    return calculateMacroTargets(
      currentWeightKg,
      profile.height_cm,
      age,
      profile.biological_sex,
      profile.activity_level,
      profile.goal,
      pace,
    );
  }, [profile, currentWeightKg, age, pace]);

  const profileComplete =
    profile !== null &&
    currentWeightKg !== null &&
    profile.height_cm !== null &&
    age !== null &&
    profile.biological_sex !== null &&
    profile.activity_level !== null &&
    profile.goal !== null;

  const showPaceSelector =
    profileComplete &&
    (profile?.goal === 'lose_fat' || profile?.goal === 'build_muscle');

  const recCal = computedTargets.calories;
  const recProtein = computedTargets.protein_g;
  const recCarbs = computedTargets.carbs_g;
  const recFat = computedTargets.fat_g;

  const [mode, setMode] = useState<Mode>('recommended');
  const [calories, setCalories] = useState(String(recCal));
  const [protein, setProtein] = useState(String(recProtein));
  const [carbs, setCarbs] = useState(String(recCarbs));
  const [fat, setFat] = useState(String(recFat));
  const [netCarbs, setNetCarbs] = useState(false);
  const [savingRec, setSavingRec] = useState(false);

  const calNum = safeNum(calories);
  const pNum = safeNum(protein);
  const cNum = safeNum(carbs);
  const fNum = safeNum(fat);
  const pCal = pNum * PROTEIN_KCAL;
  const cCal = cNum * CARBS_KCAL;
  const fCal = fNum * FAT_KCAL;
  const totalMacroCal = pCal + cCal + fCal;
  const exceeds = totalMacroCal > calNum && calNum > 0;

  const pctOf = (kcal: number) =>
    calNum > 0 ? Math.round((kcal / calNum) * 100) : 0;
  const pPct = pctOf(pCal);
  const cPct = pctOf(cCal);
  const fPct = pctOf(fCal);

  // Recommended-mode % uses the computed recommended targets so the bars
  // stay stable relative to the displayed numbers.
  const recPPct =
    recCal > 0 ? Math.round((recProtein * PROTEIN_KCAL / recCal) * 100) : 0;
  const recCPct =
    recCal > 0 ? Math.round((recCarbs * CARBS_KCAL / recCal) * 100) : 0;
  const recFPct =
    recCal > 0 ? Math.round((recFat * FAT_KCAL / recCal) * 100) : 0;

  const handleReset = () => {
    setCalories(String(recCal));
    setProtein(String(recProtein));
    setCarbs(String(recCarbs));
    setFat(String(recFat));
    toast.show('Reset to recommended targets', 'info');
  };

  const [savingCustom, setSavingCustom] = useState(false);

  const handleSave = async () => {
    if (!user || exceeds || savingCustom) return;
    setSavingCustom(true);
    try {
      await setMacroTarget({
        user_id: user.id,
        calories: calNum,
        protein_g: pNum,
        carbs_g: cNum,
        fat_g: fNum,
        is_custom: true,
        net_carbs: netCarbs,
        effective_date: new Date().toISOString().split('T')[0],
      });
      toast.show('Macro targets saved', 'success');
      setTimeout(() => router.back(), 800);
    } catch {
      toast.show('Could not save targets. Try again.', 'error');
    } finally {
      setSavingCustom(false);
    }
  };

  const handleSaveRecommended = async () => {
    if (!user || savingRec) return;
    setSavingRec(true);
    try {
      await updateProfile(user.id, { pace });
      await setMacroTarget({
        user_id: user.id,
        calories: computedTargets.calories,
        protein_g: computedTargets.protein_g,
        carbs_g: computedTargets.carbs_g,
        fat_g: computedTargets.fat_g,
        is_custom: false,
        net_carbs: false,
        effective_date: new Date().toISOString().split('T')[0],
      });
      await refreshProfile();
      toast.show('Macro targets saved');
      setTimeout(() => router.back(), 800);
    } catch {
      toast.show('Could not save targets', 'error');
    } finally {
      setSavingRec(false);
    }
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: t.bg }}
      edges={['top', 'left', 'right']}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Top nav */}
        <View
          style={{
            paddingHorizontal: space.lg,
            paddingTop: space.sm,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Pressable
            hitSlop={8}
            onPress={() => router.back()}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Ionicons name="chevron-back" size={24} color={t.primary} />
          </Pressable>
        </View>

        {/* Title */}
        <View
          style={{ paddingHorizontal: space.xl, marginTop: space.md }}
        >
          <Text style={[typo.title2, { color: t.text }]}>
            Edit macro targets
          </Text>
        </View>

        {/* Mode selector */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: t.surface2,
            borderRadius: radius.lg,
            padding: 3,
            marginHorizontal: space.xl,
            marginTop: space.lg,
          }}
        >
          {(['recommended', 'custom'] as Mode[]).map((m) => {
            const sel = mode === m;
            return (
              <Pressable
                key={m}
                onPress={() => setMode(m)}
                style={({ pressed }) => ({
                  flex: 1,
                  paddingVertical: 8,
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
                  {m === 'recommended' ? 'Recommended' : 'Custom'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: space.lg,
            paddingTop: space.lg,
            paddingBottom: space.xl,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {mode === 'recommended' ? (
            <>
              {/* Info card */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: space.sm,
                  backgroundColor: t.primarySoft,
                  borderRadius: radius.lg,
                  padding: space.lg,
                }}
              >
                <Ionicons
                  name="information-circle-outline"
                  size={18}
                  color={t.primary}
                  style={{ marginTop: 2 }}
                />
                <Text
                  style={[
                    typo.footnote,
                    { color: t.primary, flex: 1 },
                  ]}
                >
                  These targets are calculated from your goal, stats, and
                  real weight trend data. They update automatically each week.
                </Text>
              </View>

              {/* Read-only summary */}
              <View
                style={{
                  marginTop: space.lg,
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
                  {recCal.toLocaleString()}
                </Text>
                <Text
                  style={[
                    typo.subhead,
                    { color: t.textSec, textAlign: 'center' },
                  ]}
                >
                  kcal / day
                </Text>

                <View style={{ marginTop: space.lg }}>
                  <MacroBar
                    label="Protein"
                    grams={recProtein}
                    color={t.protein}
                    pct={recPPct}
                    t={t}
                  />
                  <MacroBar
                    label="Carbs"
                    grams={recCarbs}
                    color={t.carbs}
                    pct={recCPct}
                    t={t}
                  />
                  <MacroBar
                    label="Fat"
                    grams={recFat}
                    color={t.teal}
                    pct={recFPct}
                    t={t}
                  />
                </View>
              </View>

              {!profileComplete && weightLoaded && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: space.sm,
                    backgroundColor: t.warnSoft,
                    borderRadius: radius.lg,
                    padding: space.md,
                    marginTop: space.md,
                  }}
                >
                  <Ionicons
                    name="information-circle-outline"
                    size={16}
                    color={t.warn}
                    style={{ marginTop: 2 }}
                  />
                  <Text
                    style={[typo.footnote, { color: t.warn, flex: 1 }]}
                  >
                    Complete onboarding so we can compute personalised targets.
                  </Text>
                </View>
              )}

              {showPaceSelector && (
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
                    {profile?.goal === 'lose_fat'
                      ? 'How aggressive should your calorie deficit be?'
                      : 'How fast do you want to gain muscle?'}
                  </Text>
                  <View style={{ marginTop: space.md, gap: space.sm }}>
                    {(profile?.goal === 'lose_fat'
                      ? LOSE_PACES
                      : GAIN_PACES
                    ).map((p) => (
                      <PaceCard
                        key={p.id}
                        icon={p.icon}
                        title={p.title}
                        desc={p.desc}
                        selected={pace === p.id}
                        onPress={() => setPace(p.id)}
                        t={t}
                      />
                    ))}
                  </View>

                  <ProjectionCard
                    t={t}
                    goal={profile?.goal ?? null}
                    currentWeightKg={currentWeightKg}
                    goalWeightKg={profile?.goal_weight_kg ?? null}
                    isMetric={profile?.is_metric ?? false}
                    weeklyChangeKg={computedTargets.weeklyChangeKg}
                  />
                </View>
              )}

              <Pressable
                hitSlop={6}
                onPress={() => setMode('custom')}
                style={({ pressed }) => ({
                  alignSelf: 'center',
                  marginTop: space.xl,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Text style={[typo.subhead, { color: t.primary }]}>
                  Switch to custom
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              {/* Calorie input */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.sm,
                }}
              >
                <Text
                  style={[typo.subheadEm, { color: t.text, flex: 1 }]}
                >
                  Calories
                </Text>
                <TextInput
                  value={calories}
                  onChangeText={setCalories}
                  keyboardType="numeric"
                  returnKeyType="done"
                  selectTextOnFocus
                  style={[
                    typo.title2,
                    {
                      width: 120,
                      backgroundColor: t.surface2,
                      borderRadius: radius.lg,
                      paddingHorizontal: space.lg,
                      paddingVertical: space.sm,
                      color: t.text,
                      textAlign: 'center',
                    },
                  ]}
                />
                <Text style={[typo.subhead, { color: t.textSec }]}>
                  kcal
                </Text>
              </View>

              {/* Macro inputs */}
              <MacroInputRow
                label="Protein"
                value={protein}
                onChange={setProtein}
                color={t.protein}
                pct={pPct}
                t={t}
              />
              <MacroInputRow
                label="Carbs"
                value={carbs}
                onChange={setCarbs}
                color={t.carbs}
                pct={cPct}
                t={t}
              />
              <MacroInputRow
                label="Fat"
                value={fat}
                onChange={setFat}
                color={t.teal}
                pct={fPct}
                t={t}
              />

              {/* Donut */}
              <View
                style={{
                  alignItems: 'center',
                  marginTop: space.xl,
                }}
              >
                <MacroDonut
                  pCal={pCal}
                  cCal={cCal}
                  fCal={fCal}
                  calNum={calNum}
                  centerLabel={String(calNum)}
                  t={t}
                />
              </View>

              {/* Warning */}
              {exceeds && (
                <View
                  style={{
                    backgroundColor: t.dangerSoft,
                    borderRadius: radius.lg,
                    paddingHorizontal: space.md,
                    paddingVertical: space.sm,
                    marginTop: space.md,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.sm,
                  }}
                >
                  <Ionicons
                    name="warning-outline"
                    size={16}
                    color={t.danger}
                  />
                  <Text
                    style={[
                      typo.footnote,
                      { color: t.danger, flex: 1 },
                    ]}
                  >
                    Macros exceed calorie target.
                  </Text>
                </View>
              )}

              {/* Net carbs toggle */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: space.xl,
                  paddingVertical: 6,
                }}
              >
                <Text style={[typo.subhead, { color: t.text }]}>
                  Net carbs (keto)
                </Text>
                <Switch
                  value={netCarbs}
                  onValueChange={setNetCarbs}
                  trackColor={{ false: t.surface3, true: t.primary }}
                  style={{ marginLeft: space.sm }}
                />
              </View>
              {netCarbs && (
                <Text
                  style={[
                    typo.caption1,
                    { color: t.textTer, marginTop: 2 },
                  ]}
                >
                  Net carbs = total carbs minus fiber.
                </Text>
              )}

              {/* Reset link */}
              <Pressable
                hitSlop={6}
                onPress={handleReset}
                style={({ pressed }) => ({
                  alignSelf: 'center',
                  marginTop: space.xl,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Text style={[typo.subhead, { color: t.textSec }]}>
                  Reset to recommended targets
                </Text>
              </Pressable>
            </>
          )}
        </ScrollView>

        {/* Save button */}
        {mode === 'custom' ? (
          <View
            style={{
              paddingHorizontal: space.lg,
              paddingTop: space.sm,
              paddingBottom: insets.bottom + space.md,
            }}
          >
            <Pressable
              onPress={handleSave}
              disabled={exceeds || savingCustom}
              style={({ pressed }) => ({
                height: 52,
                borderRadius: radius.lg,
                backgroundColor: t.primary,
                alignItems: 'center',
                justifyContent: 'center',
                opacity:
                  exceeds || savingCustom ? 0.4 : pressed ? 0.85 : 1,
              })}
            >
              {savingCustom ? (
                <ActivityIndicator color={t.textOnPrim} />
              ) : (
                <Text style={[typo.headline, { color: t.textOnPrim }]}>
                  Save
                </Text>
              )}
            </Pressable>
          </View>
        ) : (
          profileComplete && (
            <View
              style={{
                paddingHorizontal: space.lg,
                paddingTop: space.sm,
                paddingBottom: insets.bottom + space.md,
              }}
            >
              <Pressable
                onPress={handleSaveRecommended}
                disabled={savingRec}
                style={({ pressed }) => ({
                  height: 52,
                  borderRadius: radius.lg,
                  backgroundColor: t.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: savingRec ? 0.6 : pressed ? 0.85 : 1,
                })}
              >
                {savingRec ? (
                  <ActivityIndicator color={t.textOnPrim} />
                ) : (
                  <Text style={[typo.headline, { color: t.textOnPrim }]}>
                    Save
                  </Text>
                )}
              </Pressable>
            </View>
          )
        )}
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
