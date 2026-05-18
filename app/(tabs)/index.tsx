import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
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
import { router, useFocusEffect } from 'expo-router';
import { radius, space, type as typo, useTheme } from '../../lib/theme';
import MacroSummaryCard from '../../components/MacroSummaryCard';
import MealGroupCard from '../../components/MealGroupCard';
import FoodDetailSheet from '../../components/FoodDetailSheet';
import StreakCelebration from '../../components/StreakCelebration';
import Toast from '../../components/Toast';
import { BluCalWordmark } from '../../components/BluCalWordmark';
import { groupEntries } from '../../lib/groupEntries';
import { sessionState } from '../../lib/sessionState';
import { useToast } from '../../lib/useToast';
import { useAuth } from '../../lib/AuthContext';
import {
  addWaterEntry,
  getCurrentMacroTarget,
  getFeelingEntriesForDate,
  getFoodEntriesForDate,
  getStreak,
  getWaterForDate,
  resetWaterForDate,
  setWaterExact,
} from '../../lib/db';
import type { CustomFood, FoodEntry, MacroTarget } from '../../lib/types';

// TODO: make this user-configurable in settings later
const WATER_TARGET_OZ = 80;

// Reshape a logged FoodEntry into the CustomFood shape FoodDetailSheet reads,
// so a past-day entry can be inspected in a read-only detail sheet.
function entryToDetailFood(entry: FoodEntry): CustomFood {
  return {
    id: entry.id,
    user_id: entry.user_id,
    name: entry.name,
    brand: null,
    barcode: entry.barcode,
    serving_size: entry.quantity,
    serving_unit: entry.unit,
    calories: entry.calories,
    protein_g: Number(entry.protein_g),
    carbs_g: Number(entry.carbs_g),
    fat_g: Number(entry.fat_g),
    fiber_g: entry.fiber_g,
    sugar_g: entry.sugar_g,
    sodium_mg: entry.sodium_mg,
    saturated_fat_g: entry.saturated_fat_g,
    cholesterol_mg: entry.cholesterol_mg,
    is_public: false,
    created_at: entry.created_at,
  };
}

function Header({
  initials,
  streak,
  date,
}: {
  initials: string;
  streak: number;
  date: string;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: space.xl,
        paddingTop: space.sm,
        paddingBottom: space.xs,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <View>
        <BluCalWordmark size={22} />
        <Text style={[typo.subhead, { color: t.textSec, marginTop: 2 }]}>
          {date}
        </Text>
      </View>
      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}
      >
        {streak >= 2 && (
          <View
            style={{
              height: 36,
              paddingHorizontal: 12,
              borderRadius: 18,
              backgroundColor: t.primarySoft,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Text style={{ fontSize: 18 }}>🔥</Text>
            <Text
              style={[typo.subhead, { color: t.primary, fontWeight: '800' }]}
            >
              {streak}
            </Text>
          </View>
        )}
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: t.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={[typo.subheadEm, { color: t.primary }]}>
            {initials}
          </Text>
        </View>
      </View>
    </View>
  );
}

function WaterPill({ label, onPress }: { label: string; onPress?: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        height: 36,
        paddingHorizontal: space.md,
        borderRadius: radius.md,
        backgroundColor: t.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text style={[typo.subheadEm, { color: t.primary }]}>{label}</Text>
    </Pressable>
  );
}

function WaterRow({
  oz,
  target,
  onAdd,
  onOpenSheet,
  readOnly,
}: {
  oz: number;
  target: number;
  onAdd: (amount: number) => void;
  onOpenSheet: () => void;
  readOnly?: boolean;
}) {
  const t = useTheme();
  const pct = target > 0 ? Math.min(1, oz / target) : 0;
  return (
    <Pressable
      onPress={readOnly ? undefined : onOpenSheet}
      style={({ pressed }) => ({
        marginHorizontal: space.lg,
        marginTop: space.md,
        backgroundColor: t.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: t.separator,
        padding: space.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: radius.md,
          backgroundColor: t.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="water-outline" size={24} color={t.primary} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={[
            typo.caption2,
            {
              color: t.textTer,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              fontWeight: '700',
            },
          ]}
        >
          Water
        </Text>
        <Text style={[typo.headline, { color: t.text, marginTop: 2 }]}>
          {oz}
          <Text style={[typo.body, { color: t.textSec }]}>
            {` / ${target} oz`}
          </Text>
        </Text>
        <View
          style={{
            height: 4,
            backgroundColor: t.surface2,
            borderRadius: radius.pill,
            marginTop: space.sm,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              height: '100%',
              width: `${pct * 100}%`,
              backgroundColor: t.primary,
              borderRadius: radius.pill,
            }}
          />
        </View>
      </View>
      {!readOnly && (
        <View style={{ flexDirection: 'row', gap: space.xs }}>
          <WaterPill label="+8oz" onPress={() => onAdd(8)} />
          <WaterPill label="+16oz" onPress={() => onAdd(16)} />
        </View>
      )}
    </Pressable>
  );
}

function LogFoodButton({ onPress }: { onPress?: () => void }) {
  const t = useTheme();
  // primary @ 40% opacity → append alpha byte 66 (102/255 ≈ 0.4) to the theme color
  const dashedColor = `${t.primary}66`;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        marginHorizontal: space.lg,
        marginTop: space.lg,
        borderRadius: radius.lg,
        borderWidth: 1.5,
        borderColor: dashedColor,
        borderStyle: 'dashed',
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text style={[typo.subhead, { color: t.primary }]}>+ Log food</Text>
    </Pressable>
  );
}

function WaterSheet({
  visible,
  oz,
  target,
  inputValue,
  onChangeInput,
  onClose,
  onAdd,
  onSetExact,
  onReset,
}: {
  visible: boolean;
  oz: number;
  target: number;
  inputValue: string;
  onChangeInput: (v: string) => void;
  onClose: () => void;
  onAdd: (amount: number) => void;
  onSetExact: () => void;
  onReset: () => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const pct = target > 0 ? Math.min(1, oz / target) : 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: t.scrim,
          justifyContent: 'flex-end',
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={20}
        >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: t.surface,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            paddingHorizontal: space.xl,
            paddingTop: space.lg,
            paddingBottom: insets.bottom + space.xl,
          }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
          <View style={{ alignItems: 'center' }}>
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: radius.pill,
                backgroundColor: t.surface3,
              }}
            />
          </View>

          <Text
            style={[
              typo.title3,
              { color: t.text, marginTop: space.lg },
            ]}
          >
            Water intake
          </Text>

          <View style={{ marginTop: space.lg, flexDirection: 'row', alignItems: 'baseline' }}>
            <Text
              style={[
                typo.largeTitle,
                { color: t.primary, fontVariant: ['tabular-nums'] },
              ]}
            >
              {`${oz} oz`}
            </Text>
            <Text
              style={[
                typo.subhead,
                { color: t.textSec, marginLeft: space.sm },
              ]}
            >
              {`/ ${target} oz goal`}
            </Text>
          </View>

          <View
            style={{
              height: 4,
              backgroundColor: t.surface2,
              borderRadius: radius.pill,
              marginTop: space.md,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                height: '100%',
                width: `${pct * 100}%`,
                backgroundColor: t.primary,
                borderRadius: radius.pill,
              }}
            />
          </View>

          <Text
            style={[
              typo.caption2,
              {
                color: t.textTer,
                letterSpacing: 0.06,
                textTransform: 'uppercase',
                fontWeight: '700',
                marginTop: space.xl,
              },
            ]}
          >
            Quick add
          </Text>
          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
            {[8, 16, 32].map((amt) => (
              <Pressable
                key={amt}
                onPress={() => onAdd(amt)}
                style={({ pressed }) => ({
                  flex: 1,
                  height: 44,
                  borderRadius: radius.md,
                  backgroundColor: t.primarySoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Text style={[typo.subheadEm, { color: t.primary }]}>
                  {`+${amt}oz`}
                </Text>
              </Pressable>
            ))}
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.sm,
              marginTop: space.xl,
              paddingTop: space.md,
              borderTopWidth: 0.5,
              borderTopColor: t.hairline,
            }}
          >
            <Text style={[typo.subhead, { color: t.textSec, flex: 1 }]}>
              Set exact amount
            </Text>
            <TextInput
              value={inputValue}
              onChangeText={onChangeInput}
              keyboardType="number-pad"
              returnKeyType="done"
              placeholder="0"
              placeholderTextColor={t.textTer}
              style={[
                typo.subhead,
                {
                  width: 80,
                  height: 36,
                  borderRadius: radius.md,
                  backgroundColor: t.surface2,
                  color: t.text,
                  textAlign: 'center',
                  padding: 0,
                },
              ]}
            />
            <Text style={[typo.subhead, { color: t.textSec }]}>oz</Text>
            <Pressable
              onPress={onSetExact}
              disabled={!inputValue.trim()}
              style={({ pressed }) => ({
                height: 36,
                paddingHorizontal: space.md,
                borderRadius: radius.md,
                backgroundColor: t.primary,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: !inputValue.trim() ? 0.4 : pressed ? 0.85 : 1,
              })}
            >
              <Text style={[typo.subheadEm, { color: t.textOnPrim }]}>
                Set
              </Text>
            </Pressable>
          </View>

          <Pressable
            onPress={onReset}
            style={({ pressed }) => ({
              marginTop: space.xl,
              height: 44,
              borderRadius: radius.md,
              backgroundColor: t.dangerSoft,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text style={[typo.subheadEm, { color: t.danger }]}>
              Reset to 0
            </Text>
          </Pressable>
          </ScrollView>
        </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

function Fab({ onPress }: { onPress?: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        position: 'absolute',
        right: 20,
        bottom: insets.bottom + 16,
        width: 56,
        height: 56,
        borderRadius: 999,
        backgroundColor: t.primary,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 12,
        elevation: 6,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Ionicons name="add" size={26} color={t.textOnPrim} />
    </Pressable>
  );
}

export default function Today() {
  const t = useTheme();
  const { user, profile } = useAuth();

  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [macroTarget, setMacroTarget] = useState<MacroTarget | null>(null);
  const [streak, setStreak] = useState(0);
  const [waterOz, setWaterOz] = useState(0);
  const [hasFeelingToday, setHasFeelingToday] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [readOnlyFood, setReadOnlyFood] = useState<CustomFood | null>(null);

  const [feelingDismissed, setFeelingDismissed] = useState(false);
  const [waterSheetOpen, setWaterSheetOpen] = useState(false);
  const [waterInput, setWaterInput] = useState('');
  const toast = useToast();

  // Throttle re-fetches on tab focus. Tab focus fires often (navigating
  // back from modals, sub-screens, etc.) and a full reload each time is
  // wasteful and causes a loading flicker on screens that already have data.
  const lastLoadTime = useRef<number>(0);

  const loadTodayData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const [todayEntries, target, currentStreak, water, feelings] =
        await Promise.all([
          getFoodEntriesForDate(user.id, selectedDate),
          getCurrentMacroTarget(user.id),
          getStreak(user.id),
          getWaterForDate(user.id, selectedDate),
          getFeelingEntriesForDate(user.id, selectedDate),
        ]);
      setEntries(todayEntries);
      setMacroTarget(target);
      setStreak(currentStreak);
      setWaterOz(water);
      setHasFeelingToday(feelings.length > 0);
      lastLoadTime.current = Date.now();
    } catch {
      setError('Could not load your food log. Pull down to retry.');
    } finally {
      setLoading(false);
    }
  }, [user, selectedDate]);

  const handleAddWater = useCallback(
    async (oz: number) => {
      if (!user) return;
      try {
        await addWaterEntry(user.id, oz);
        setWaterOz((prev) => prev + oz);
      } catch {
        toast.show('Could not log water. Try again.', 'error');
      }
    },
    [user, toast],
  );

  const handleSetExactWater = useCallback(async () => {
    if (!user) return;
    const oz = Number(waterInput);
    if (!Number.isFinite(oz) || oz < 0) {
      toast.show('Enter a valid amount.', 'error');
      return;
    }
    try {
      await setWaterExact(user.id, oz, new Date());
      setWaterOz(oz);
      setWaterInput('');
      setWaterSheetOpen(false);
    } catch {
      toast.show('Could not update water. Try again.', 'error');
    }
  }, [user, waterInput, toast]);

  const handleResetWater = useCallback(() => {
    if (!user) return;
    Alert.alert(
      'Reset water?',
      "This will clear today's water log.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await resetWaterForDate(user.id, new Date());
              setWaterOz(0);
              setWaterSheetOpen(false);
            } catch {
              toast.show('Could not reset water. Try again.', 'error');
            }
          },
        },
      ],
    );
  }, [user, toast]);

  useFocusEffect(
    useCallback(() => {
      setFeelingDismissed(sessionState.getFeelingDismissed());
      const logged = sessionState.getJustLoggedFood();
      const needsRefresh = sessionState.getNeedsRefresh();
      if (logged) {
        toast.show(`Added: ${logged}`, 'success');
        sessionState.setJustLoggedFood(null);
      }
      if (needsRefresh) sessionState.setNeedsRefresh(false);
      if (!user) return;
      // Force a reload if the user just logged food or another screen flagged
      // a data change; otherwise reload only when data is older than 60s.
      const now = Date.now();
      if (logged || needsRefresh || now - lastLoadTime.current > 60000) {
        void loadTodayData();
      }
    }, [user, loadTodayData, toast]),
  );

  // Reload immediately when the user navigates to a different day. The
  // throttled focus effect would otherwise suppress the refresh.
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    lastLoadTime.current = Date.now();
    void loadTodayData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    if (
      (streak === 7 || streak === 14 || streak === 30) &&
      sessionState.getCelebrationDismissedForStreak() !== streak
    ) {
      setShowCelebration(true);
    }
  }, [streak]);

  const handleCelebrationClose = useCallback(() => {
    setShowCelebration(false);
    sessionState.setCelebrationDismissedForStreak(streak);
  }, [streak]);

  const bounceY = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceY, {
          toValue: 6,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(bounceY, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [bounceY]);

  const groups = groupEntries(entries);
  const totalItems = entries.length;
  const isEmpty = groups.length === 0;

  const totalCal = entries.reduce((s, e) => s + e.calories, 0);
  const totalP = entries.reduce((s, e) => s + Number(e.protein_g), 0);
  const totalC = entries.reduce((s, e) => s + Number(e.carbs_g), 0);
  const totalF = entries.reduce((s, e) => s + Number(e.fat_g), 0);

  const targetCal = macroTarget?.calories ?? 2000;
  const targetP = macroTarget?.protein_g ?? 160;
  const targetC = macroTarget?.carbs_g ?? 220;
  const targetF = macroTarget?.fat_g ?? 65;

  const isToday = selectedDate.toDateString() === new Date().toDateString();

  const goToPrevDay = () => {
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 1);
    setSelectedDate(prev);
  };

  const goToNextDay = () => {
    if (isToday) return;
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    setSelectedDate(next);
  };

  const fullDateLabel = selectedDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const dateLabel = isToday ? 'Today' : fullDateLabel;

  const initials = profile?.name
    ? profile.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: t.bg }}
      edges={['top', 'left', 'right']}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140 }}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadTodayData}
            tintColor={t.primary}
          />
        }
      >
        <Header initials={initials} streak={streak} date={fullDateLabel} />

        {/* Date navigator — its own centered row just below the header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: space.md,
            paddingVertical: 6,
          }}
        >
          <Pressable onPress={goToPrevDay} hitSlop={16}>
            <Ionicons name="chevron-back" size={18} color={t.textSec} />
          </Pressable>
          <Pressable onPress={() => setSelectedDate(new Date())}>
            <Text
              style={[
                typo.caption1,
                {
                  color: isToday ? t.primary : t.textSec,
                  fontWeight: '600',
                },
              ]}
            >
              {dateLabel}
            </Text>
          </Pressable>
          <Pressable
            onPress={goToNextDay}
            hitSlop={16}
            style={{ opacity: isToday ? 0.3 : 1 }}
          >
            <Ionicons name="chevron-forward" size={18} color={t.textSec} />
          </Pressable>
        </View>

        {/* Past-day banner */}
        {!isToday && (
          <Pressable
            onPress={() => setSelectedDate(new Date())}
            style={({ pressed }) => ({
              marginHorizontal: space.lg,
              marginBottom: space.xs,
              backgroundColor: t.primarySoft,
              borderRadius: radius.md,
              paddingHorizontal: space.md,
              paddingVertical: space.sm,
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.xs,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Ionicons name="time-outline" size={14} color={t.primary} />
            <Text style={[typo.caption1, { color: t.primary, flex: 1 }]}>
              Viewing a past day. Tap to return to today.
            </Text>
          </Pressable>
        )}

        <View style={{ paddingHorizontal: space.lg, paddingTop: space.md }}>
          <MacroSummaryCard
            consumed={Math.round(totalCal)}
            target={targetCal}
            protein={{ cur: Math.round(totalP), target: targetP }}
            carbs={{ cur: Math.round(totalC), target: targetC }}
            fat={{ cur: Math.round(totalF), target: targetF }}
          />
        </View>

        <WaterRow
          oz={waterOz}
          target={WATER_TARGET_OZ}
          onAdd={handleAddWater}
          onOpenSheet={() => setWaterSheetOpen(true)}
          readOnly={!isToday}
        />

        {/* How are you feeling? row — hidden once a feeling is logged today,
            and also hidden for the rest of the session if Skipped. */}
        {isToday && !hasFeelingToday && !feelingDismissed && (
          <Pressable
            onPress={() => router.push('/feeling')}
            style={({ pressed }) => ({
              marginHorizontal: space.lg,
              marginTop: space.md,
              backgroundColor: t.surface,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: t.hairline,
              paddingHorizontal: space.lg,
              paddingVertical: space.md,
              flexDirection: 'row',
              alignItems: 'center',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Ionicons name="happy-outline" size={20} color={t.textSec} />
            <Text
              style={[
                typo.subhead,
                { color: t.textSec, flex: 1, marginLeft: space.sm },
              ]}
            >
              Log energy & hunger
            </Text>
            <Ionicons name="chevron-forward" size={16} color={t.textTer} />
          </Pressable>
        )}

        {/* Food log section header */}
        <View
          style={{
            paddingHorizontal: space.lg,
            paddingTop: space.xl,
            paddingBottom: space.sm,
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
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
              },
            ]}
          >
            Food log
          </Text>
          {!isEmpty && (
            <Text style={[typo.caption1, { color: t.textTer }]}>
              {`${groups.length} meal${groups.length === 1 ? '' : 's'} · ${totalItems} item${totalItems === 1 ? '' : 's'}`}
            </Text>
          )}
        </View>

        {error ? (
          <View
            style={{
              alignItems: 'center',
              paddingVertical: space.xxxl,
              paddingHorizontal: space.xl,
            }}
          >
            <Ionicons
              name="cloud-offline-outline"
              size={48}
              color={t.textTer}
            />
            <Text
              style={[
                typo.subhead,
                {
                  color: t.textSec,
                  marginTop: space.md,
                  textAlign: 'center',
                },
              ]}
            >
              {error}
            </Text>
            <Pressable
              onPress={loadTodayData}
              style={({ pressed }) => ({
                marginTop: space.md,
                paddingHorizontal: space.lg,
                paddingVertical: space.sm,
                borderRadius: radius.md,
                backgroundColor: t.primarySoft,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text style={[typo.subheadEm, { color: t.primary }]}>Retry</Text>
            </Pressable>
          </View>
        ) : loading && isEmpty ? (
          <View
            style={{
              alignItems: 'center',
              paddingVertical: space.xxxl,
            }}
          >
            <ActivityIndicator color={t.primary} />
          </View>
        ) : isEmpty ? (
          <View
            style={{
              alignItems: 'center',
              paddingVertical: space.xxxl,
              paddingHorizontal: space.xl,
            }}
          >
            <Ionicons
              name="restaurant-outline"
              size={48}
              color={t.textTer}
            />
            <Text
              style={[
                typo.subhead,
                { color: t.textTer, marginTop: space.md },
              ]}
            >
              {isToday ? 'Nothing logged yet' : 'Nothing logged this day'}
            </Text>
            {isToday && (
              <>
                <Text
                  style={[
                    typo.footnote,
                    { color: t.textTer, marginTop: space.xs },
                  ]}
                >
                  Tap + to log your first meal
                </Text>
                <Animated.View
                  style={{
                    marginTop: space.md,
                    transform: [
                      { translateY: bounceY },
                      { rotate: '45deg' },
                    ],
                  }}
                >
                  <Ionicons
                    name="arrow-forward-outline"
                    size={20}
                    color={t.textTer}
                  />
                </Animated.View>
              </>
            )}
          </View>
        ) : (
          <View style={{ paddingHorizontal: space.lg, gap: 10 }}>
            {groups.map((g) => (
              <MealGroupCard
                key={g.id}
                group={g}
                readOnly={!isToday}
                onReadOnlyPress={(item) =>
                  setReadOnlyFood(entryToDetailFood(item))
                }
              />
            ))}
          </View>
        )}

        {isToday && (
          <LogFoodButton onPress={() => router.push('/log-food')} />
        )}
      </ScrollView>

      {isToday && <Fab onPress={() => router.push('/log-food')} />}

      <StreakCelebration
        visible={showCelebration}
        onClose={handleCelebrationClose}
        streakDays={streak}
      />

      <WaterSheet
        visible={waterSheetOpen}
        oz={waterOz}
        target={WATER_TARGET_OZ}
        inputValue={waterInput}
        onChangeInput={setWaterInput}
        onClose={() => setWaterSheetOpen(false)}
        onAdd={handleAddWater}
        onSetExact={handleSetExactWater}
        onReset={handleResetWater}
      />

      {/* Read-only detail for a tapped past-day entry */}
      <FoodDetailSheet
        food={readOnlyFood}
        readOnly
        currentMacros={{
          cal: Math.round(totalCal),
          protein: Math.round(totalP),
          carbs: Math.round(totalC),
          fat: Math.round(totalF),
        }}
        targets={{
          cal: targetCal,
          protein: targetP,
          carbs: targetC,
          fat: targetF,
        }}
        onDismiss={() => setReadOnlyFood(null)}
        onLog={() => {}}
      />

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
