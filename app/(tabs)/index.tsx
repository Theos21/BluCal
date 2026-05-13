import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { radius, space, type as typo, useTheme } from '../../lib/theme';
import MacroSummaryCard from '../../components/MacroSummaryCard';
import MealGroupCard from '../../components/MealGroupCard';
import StreakCelebration from '../../components/StreakCelebration';
import Toast from '../../components/Toast';
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
} from '../../lib/db';
import type { FoodEntry, MacroTarget } from '../../lib/types';

// TODO: make this user-configurable in settings later
const WATER_TARGET_OZ = 80;

function Header({
  initials,
  dateLabel,
  streak,
}: {
  initials: string;
  dateLabel: string;
  streak: number;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: space.xl,
        paddingTop: space.sm,
        paddingBottom: space.xs,
        flexDirection: 'row',
        alignItems: 'flex-start',
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={[typo.title1, { color: t.text }]}>Today</Text>
        <Text style={[typo.subhead, { color: t.textSec, marginTop: 2 }]}>
          {dateLabel}
        </Text>
      </View>
      {streak >= 2 && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: radius.pill,
            backgroundColor: t.warnSoft,
            marginRight: space.sm,
          }}
        >
          <Ionicons name="flame-outline" size={14} color={t.warn} />
          <Text style={[typo.caption1, { color: t.warn, fontWeight: '600' }]}>
            {streak}
          </Text>
        </View>
      )}
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: t.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={[typo.subheadEm, { color: t.primary }]}>{initials}</Text>
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
}: {
  oz: number;
  target: number;
  onAdd: (amount: number) => void;
}) {
  const t = useTheme();
  const pct = target > 0 ? Math.min(1, oz / target) : 0;
  return (
    <View
      style={{
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
      }}
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
      <View style={{ flexDirection: 'row', gap: space.xs }}>
        <WaterPill label="+8oz" onPress={() => onAdd(8)} />
        <WaterPill label="+16oz" onPress={() => onAdd(16)} />
      </View>
    </View>
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

function Fab({ onPress }: { onPress?: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        position: 'absolute',
        right: 20,
        bottom: 96,
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

  const [feelingDismissed, setFeelingDismissed] = useState(false);
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
          getFoodEntriesForDate(user.id, new Date()),
          getCurrentMacroTarget(user.id),
          getStreak(user.id),
          getWaterForDate(user.id, new Date()),
          getFeelingEntriesForDate(user.id, new Date()),
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
  }, [user]);

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

  useFocusEffect(
    useCallback(() => {
      setFeelingDismissed(sessionState.getFeelingDismissed());
      const logged = sessionState.getJustLoggedFood();
      if (logged) {
        toast.show(`Added: ${logged}`, 'success');
        sessionState.setJustLoggedFood(null);
      }
      if (!user) return;
      // Force a reload if the user just logged food (local state is now
      // stale by definition); otherwise reload only when data is older
      // than 60s.
      const now = Date.now();
      if (logged || now - lastLoadTime.current > 60000) {
        void loadTodayData();
      }
    }, [user, loadTodayData, toast]),
  );

  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    if (streak === 7 || streak === 14 || streak === 30) {
      setShowCelebration(true);
    }
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

  const today = new Date();
  const dateLabel = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

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
        <Header initials={initials} dateLabel={dateLabel} streak={streak} />

        <View style={{ paddingHorizontal: space.lg, paddingTop: space.md }}>
          <MacroSummaryCard
            consumed={Math.round(totalCal)}
            target={targetCal}
            protein={{ cur: Math.round(totalP), target: targetP }}
            carbs={{ cur: Math.round(totalC), target: targetC }}
            fat={{ cur: Math.round(totalF), target: targetF }}
          />
        </View>

        <WaterRow oz={waterOz} target={WATER_TARGET_OZ} onAdd={handleAddWater} />

        {/* How are you feeling? row — hidden once a feeling is logged today,
            and also hidden for the rest of the session if Skipped. */}
        {!hasFeelingToday && !feelingDismissed && (
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
              Nothing logged yet
            </Text>
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
          </View>
        ) : (
          <View style={{ paddingHorizontal: space.lg, gap: 10 }}>
            {groups.map((g) => (
              <MealGroupCard key={g.id} group={g} />
            ))}
          </View>
        )}

        <LogFoodButton onPress={() => router.push('/log-food')} />
      </ScrollView>

      <Fab onPress={() => router.push('/log-food')} />

      <StreakCelebration
        visible={showCelebration}
        onClose={() => setShowCelebration(false)}
        streakDays={streak}
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
