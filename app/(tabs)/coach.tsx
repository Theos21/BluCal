import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  ListRenderItem,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { radius, space, type as typo, useTheme } from '../../lib/theme';
import { useAuth } from '../../lib/AuthContext';
import {
  getCurrentMacroTarget,
  getFoodEntriesForDateRange,
  getStreak,
  getWeightEntries,
} from '../../lib/db';
import { calculateAge, calculateMacroTargets } from '../../lib/macroCalculator';
import type { MacroTarget, Pace, WeightEntry } from '../../lib/types';

type Role = 'user' | 'coach';

type ChatMessage = {
  id: string;
  role: Role;
  text: string;
  time: string;
  isTyping?: boolean;
};

// Welcome / onboarding thread shown until the live coach is wired up.
const mockMessages: ChatMessage[] = [
  {
    id: '1',
    role: 'coach',
    text: "Hey! I've been looking at your logs this week. Really solid protein consistency. You hit your target 6 out of 7 days.",
    time: '9:01 AM',
  },
  {
    id: '2',
    role: 'user',
    text: 'Thanks! I felt like Sunday was rough though.',
    time: '9:03 AM',
  },
  {
    id: '3',
    role: 'coach',
    text: 'Sunday your protein came in at 89g vs your 160g target. Try adding a Greek yogurt or protein shake as an evening snack. Quick win.',
    time: '9:03 AM',
  },
  {
    id: '4',
    role: 'user',
    text: 'Good idea. Should I adjust my lunch too?',
    time: '9:05 AM',
  },
  {
    id: '5',
    role: 'coach',
    text: 'Your lunches are actually great, averaging 52g protein. The gap is almost entirely in the evening. Keep lunch as is.',
    time: '9:05 AM',
  },
];

// Canned coach replies used while live LLM responses are not wired.
const mockReplies = [
  "Great question! Based on your recent logs, I'd suggest focusing on consistency over the next week.",
  "Your weight trend is looking really good. You're losing at a sustainable pace.",
  'I noticed your carbs have been a bit low the last few days. That might be affecting your energy levels.',
  'Keep it up! Your momentum score has been climbing steadily this week.',
];

const INSIGHT_DAYS_NEEDED = 4;

// TODO: replace with a personalised insight derived from real logs.
const WEEKLY_INSIGHT =
  'You hit your protein target 6 out of 7 days this week. Your lowest day was Sunday at 89g. Try adding a snack that evening.';

function formatTime(d: Date): string {
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 === 0 ? 12 : h % 12;
  return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
}

// ── Summary card ─────────────────────────────────────────────────────────────
function StatPill({
  value,
  label,
  valueColor,
}: {
  value: string;
  label: string;
  valueColor?: string;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: t.surface2,
        borderRadius: radius.md,
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
        alignItems: 'center',
      }}
    >
      <Text
        style={[
          typo.subheadEm,
          { color: valueColor ?? t.text, fontVariant: ['tabular-nums'] },
        ]}
      >
        {value}
      </Text>
      <Text
        style={[
          typo.caption2,
          {
            color: t.textTer,
            marginTop: 2,
            letterSpacing: 0.06,
            textTransform: 'uppercase',
            fontWeight: '700',
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function SummaryCard({
  loading,
  momentum,
  avgCalLabel,
  weightTrendLabel,
  weightTrendColor,
  goalPacing,
}: {
  loading: boolean;
  momentum: number;
  avgCalLabel: string;
  weightTrendLabel: string;
  weightTrendColor: string;
  goalPacing: string;
}) {
  const t = useTheme();
  if (loading) {
    return (
      <View
        style={{
          backgroundColor: t.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: t.hairline,
          marginHorizontal: space.lg,
          marginTop: space.md,
          padding: space.lg,
          minHeight: 140,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={t.primary} />
      </View>
    );
  }
  return (
    <View
      style={{
        backgroundColor: t.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: t.hairline,
        marginHorizontal: space.lg,
        marginTop: space.md,
        padding: space.lg,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View>
          <Text
            style={[
              typo.title1,
              { color: t.success, fontVariant: ['tabular-nums'] },
            ]}
          >
            {momentum}
          </Text>
          <Text
            style={[
              typo.caption2,
              {
                color: t.textTer,
                marginTop: 2,
                letterSpacing: 0.06,
                textTransform: 'uppercase',
                fontWeight: '700',
              },
            ]}
          >
            Momentum
          </Text>
        </View>
        <View
          style={{
            backgroundColor: t.successSoft,
            borderRadius: radius.pill,
            paddingHorizontal: space.md,
            paddingVertical: 6,
          }}
        >
          <Text
            style={[typo.caption2, { color: t.success, fontWeight: '700' }]}
          >
            On track
          </Text>
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          gap: space.sm,
          marginTop: space.md,
        }}
      >
        <StatPill value={avgCalLabel} label="weekly avg" />
        <StatPill
          value={weightTrendLabel}
          label="weight trend"
          valueColor={weightTrendColor}
        />
        <StatPill value={goalPacing} label="to goal" />
      </View>
    </View>
  );
}

function InsightCard({
  hasInsightData,
  daysLogged,
}: {
  hasInsightData: boolean;
  daysLogged: number;
}) {
  const t = useTheme();
  if (!hasInsightData) {
    const remaining = Math.max(0, INSIGHT_DAYS_NEEDED - daysLogged);
    return (
      <View
        style={{
          backgroundColor: t.primarySoft,
          borderRadius: radius.lg,
          marginHorizontal: space.lg,
          marginTop: space.md,
          marginBottom: space.lg,
          padding: space.lg,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: space.sm,
          }}
        >
          <Ionicons
            name="lock-closed-outline"
            size={20}
            color={t.primary}
            style={{ marginTop: 2 }}
          />
          <Text style={[typo.subhead, { color: t.text, flex: 1 }]}>
            {`Log for ${remaining} more days to unlock personalized insights`}
          </Text>
        </View>
        <View
          style={{
            flexDirection: 'row',
            gap: 6,
            marginTop: space.md,
          }}
        >
          {Array.from({ length: INSIGHT_DAYS_NEEDED }).map((_, i) => (
            <View
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: i < daysLogged ? t.primary : t.surface3,
              }}
            />
          ))}
        </View>
      </View>
    );
  }
  return (
    <View
      style={{
        backgroundColor: t.primarySoft,
        borderRadius: radius.lg,
        marginHorizontal: space.lg,
        marginTop: space.md,
        marginBottom: space.lg,
        padding: space.lg,
      }}
    >
      <Text
        style={[
          typo.caption2,
          {
            color: t.primary,
            letterSpacing: 0.06,
            textTransform: 'uppercase',
            fontWeight: '700',
          },
        ]}
      >
        This week
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: space.sm,
          marginTop: space.sm,
        }}
      >
        <Ionicons
          name="bulb-outline"
          size={20}
          color={t.primary}
          style={{ marginTop: 2 }}
        />
        <Text style={[typo.subhead, { color: t.text, flex: 1 }]}>
          {WEEKLY_INSIGHT}
        </Text>
      </View>
    </View>
  );
}

// ── Chat ─────────────────────────────────────────────────────────────────────
function UserBubble({ message }: { message: ChatMessage }) {
  const t = useTheme();
  return (
    <View style={{ marginVertical: space.xs, alignItems: 'flex-end' }}>
      <View
        style={{
          maxWidth: '75%',
          backgroundColor: t.primary,
          borderRadius: radius.xl,
          borderBottomRightRadius: radius.xs,
          paddingHorizontal: space.md,
          paddingVertical: space.sm,
        }}
      >
        <Text style={[typo.subhead, { color: t.textOnPrim }]}>
          {message.text}
        </Text>
      </View>
      <Text
        style={[
          typo.caption2,
          { color: t.textTer, marginTop: 4, marginRight: 2 },
        ]}
      >
        {message.time}
      </Text>
    </View>
  );
}

function TypingDots() {
  const t = useTheme();
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // Wave timing: each dot animates 300ms up + 300ms down (600ms total).
    // Dots stagger by 150ms (0 / 150 / 300). Tail delay keeps every dot's
    // cycle at 900ms so the wave realigns each loop with a brief pause.
    const pulse = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0.3,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.delay(300 - delay),
        ]),
      );
    const a1 = pulse(dot1, 0);
    const a2 = pulse(dot2, 150);
    const a3 = pulse(dot3, 300);
    a1.start();
    a2.start();
    a3.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [dot1, dot2, dot3]);

  const dotStyle = {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: t.textTer,
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Animated.View style={[dotStyle, { opacity: dot1 }]} />
      <Animated.View style={[dotStyle, { opacity: dot2 }]} />
      <Animated.View style={[dotStyle, { opacity: dot3 }]} />
    </View>
  );
}

function CoachBubble({ message }: { message: ChatMessage }) {
  const t = useTheme();
  return (
    <View
      style={{
        marginVertical: space.xs,
        flexDirection: 'row',
        alignItems: 'flex-end',
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: t.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: space.sm,
          marginBottom: 18,
        }}
      >
        <Text
          style={[
            typo.caption2,
            { color: t.primary, fontWeight: '700' },
          ]}
        >
          BC
        </Text>
      </View>
      <View style={{ maxWidth: '75%', alignItems: 'flex-start' }}>
        <View
          style={{
            backgroundColor: t.surface2,
            borderRadius: radius.xl,
            borderBottomLeftRadius: radius.xs,
            paddingHorizontal: space.md,
            paddingVertical: space.sm,
          }}
        >
          {message.isTyping ? (
            <TypingDots />
          ) : (
            <Text style={[typo.subhead, { color: t.text }]}>
              {message.text}
            </Text>
          )}
        </View>
        {!message.isTyping && (
          <Text
            style={[
              typo.caption2,
              { color: t.textTer, marginTop: 4, marginLeft: 2 },
            ]}
          >
            {message.time}
          </Text>
        )}
      </View>
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────
export default function Coach() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();

  const [messages, setMessages] = useState<ChatMessage[]>(mockMessages);
  const [input, setInput] = useState('');

  // Summary card data
  const [, setMacroTarget] = useState<MacroTarget | null>(null);
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([]);
  const [weeklyAvgCal, setWeeklyAvgCal] = useState(0);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadCoachData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const [target, weights, currentStreak, weekFood] = await Promise.all([
        getCurrentMacroTarget(user.id),
        getWeightEntries(user.id, 14),
        getStreak(user.id),
        getFoodEntriesForDateRange(user.id, sevenDaysAgo, new Date()),
      ]);

      setMacroTarget(target);
      const weightsDesc = weights.slice().reverse();
      setWeightEntries(weightsDesc);
      setStreak(currentStreak);

      const totalCal = weekFood.reduce((s, e) => s + e.calories, 0);
      const uniqueDays = new Set(
        weekFood.map((e) =>
          new Date(e.logged_at).toLocaleDateString('en-CA'),
        ),
      ).size;
      setWeeklyAvgCal(
        uniqueDays > 0 ? Math.round(totalCal / uniqueDays) : 0,
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      void loadCoachData();
      // loadCoachData reads `user` from closure; re-run when user changes.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]),
  );

  const canSend = input.trim().length > 0;

  const handleSend = () => {
    if (!canSend) return;
    const text = input.trim();
    const now = new Date();
    const sendId = Date.now();
    const userMsg: ChatMessage = {
      id: `u-${sendId}`,
      role: 'user',
      text,
      time: formatTime(now),
    };
    const typingId = `typing-${sendId}`;
    const typingMsg: ChatMessage = {
      id: typingId,
      role: 'coach',
      text: '',
      time: '',
      isTyping: true,
    };
    setMessages((prev) => [...prev, userMsg, typingMsg]);
    setInput('');

    setTimeout(() => {
      const reply =
        mockReplies[Math.floor(Math.random() * mockReplies.length)];
      setMessages((prev) =>
        prev.map((m) =>
          m.id === typingId
            ? {
                id: `c-${Date.now()}`,
                role: 'coach',
                text: reply,
                time: formatTime(new Date()),
                isTyping: false,
              }
            : m,
        ),
      );
    }, 1500);
  };

  // ── Derived summary values ──────────────────────────────────────────────
  const avgCalLabel =
    weeklyAvgCal > 0 ? `${weeklyAvgCal.toLocaleString()} kcal` : '--';

  const computeWeightTrend = (): { label: string; color: string } => {
    if (weightEntries.length < 2) {
      return { label: 'Not enough data', color: t.text };
    }
    const recent = weightEntries.slice(0, 7);
    const older = weightEntries.slice(7, 14);
    if (older.length === 0) {
      return { label: 'Not enough data', color: t.text };
    }
    const recentAvg =
      recent.reduce((s, e) => s + Number(e.weight_kg), 0) / recent.length;
    const olderAvg =
      older.reduce((s, e) => s + Number(e.weight_kg), 0) / older.length;
    const diffKg = recentAvg - olderAvg;
    const diff = profile?.is_metric ? diffKg : diffKg * 2.20462;
    const unit = profile?.is_metric ? 'kg' : 'lbs';

    if (Math.abs(diff) < 0.1) {
      // Stable is "correct" for maintain / performance, neutral otherwise.
      const stableIsGood =
        profile?.goal === 'maintain' || profile?.goal === 'performance';
      return { label: 'Stable', color: stableIsGood ? t.teal : t.text };
    }

    const label = `${diff > 0 ? '+' : ''}${diff.toFixed(1)} ${unit}/wk`;
    let color = t.text;
    if (profile?.goal === 'lose_fat') color = diff < 0 ? t.teal : t.warn;
    else if (profile?.goal === 'build_muscle')
      color = diff > 0 ? t.teal : t.warn;
    return { label, color };
  };

  const weightTrend = computeWeightTrend();

  const getGoalPacing = (): string => {
    if (!profile?.goal_weight_kg) return '--';
    if (weightEntries.length < 2) return '--';
    const latestKg = Number(weightEntries[0].weight_kg);
    const goalKg = profile.goal_weight_kg;
    const diffKg = Math.abs(goalKg - latestKg);
    if (diffKg < 0.5) return 'Goal reached!';
    if (!profile.pace || !profile.activity_level || !profile.goal)
      return '--';
    const age = calculateAge(profile.birthday);
    const { weeklyChangeKg } = calculateMacroTargets(
      latestKg,
      profile.height_cm ?? 170,
      age,
      profile.biological_sex ?? 'male',
      profile.activity_level,
      profile.goal,
      profile.pace as Pace,
    );
    if (weeklyChangeKg === 0) return '--';
    const weeks = Math.round(diffKg / Math.abs(weeklyChangeKg));
    return `~${weeks} weeks`;
  };

  const goalPacing = getGoalPacing();

  // TODO: derive a real momentum score from logging consistency + macro hits.
  const momentum = 0;

  const hasInsightData = weeklyAvgCal > 0 || weightEntries.length > 0;
  const daysLogged = Math.min(streak, INSIGHT_DAYS_NEEDED);

  // FlatList with `inverted` expects newest first
  const data = [...messages].reverse();

  const renderItem: ListRenderItem<ChatMessage> = ({ item }) =>
    item.role === 'user' ? (
      <UserBubble message={item} />
    ) : (
      <CoachBubble message={item} />
    );

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
        <View
          style={{
            paddingHorizontal: space.xl,
            paddingTop: space.lg,
          }}
        >
          <Text style={[typo.largeTitle, { color: t.text }]}>Coach</Text>
        </View>

        {/* Chat list */}
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          inverted
          contentContainerStyle={{
            paddingHorizontal: space.lg,
            paddingTop: space.md,
            paddingBottom: space.md,
          }}
          ListFooterComponent={
            <View>
              <SummaryCard
                loading={loading}
                momentum={momentum}
                avgCalLabel={avgCalLabel}
                weightTrendLabel={weightTrend.label}
                weightTrendColor={weightTrend.color}
                goalPacing={goalPacing}
              />
              <InsightCard
                hasInsightData={hasInsightData}
                daysLogged={daysLogged}
              />
            </View>
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />

        {/* Input bar */}
        <View
          style={{
            backgroundColor: t.surface,
            borderTopWidth: 0.5,
            borderTopColor: t.hairline,
            paddingHorizontal: space.lg,
            paddingTop: space.sm,
            paddingBottom: insets.bottom + space.sm,
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: space.sm,
          }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: t.surface2,
              borderRadius: radius.pill,
              paddingHorizontal: 16,
              paddingVertical: 10,
            }}
          >
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Ask your coach anything…"
              placeholderTextColor={t.textTer}
              multiline
              style={[typo.body, { color: t.text, padding: 0, maxHeight: 100 }]}
            />
          </View>
          <Pressable
            onPress={handleSend}
            disabled={!canSend}
            style={({ pressed }) => ({
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: t.primary,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: canSend ? (pressed ? 0.6 : 1) : 0.4,
            })}
          >
            <Ionicons
              name="paper-plane-outline"
              size={16}
              color={t.textOnPrim}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
