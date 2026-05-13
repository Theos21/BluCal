import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Svg, { Circle, Polyline, Text as SvgText } from 'react-native-svg';
import { radius, space, type as typo, useTheme, type Theme } from '../lib/theme';
import Toast from '../components/Toast';
import { useToast } from '../lib/useToast';
import { useAuth } from '../lib/AuthContext';
import { addWeightEntry, getWeightEntries } from '../lib/db';
import type { WeightEntry } from '../lib/types';

type Unit = 'lbs' | 'kg';

function formatTodayLong(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function getRecentDayLabels(): string[] {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    return d.toLocaleDateString('en-US', { weekday: 'short' });
  });
}

// ── Sparkline ────────────────────────────────────────────────────────────────
function WeightSparkline({
  width,
  data,
  t,
}: {
  width: number;
  data: number[];
  t: Theme;
}) {
  const labels = getRecentDayLabels();
  const padT = 8;
  const padB = 8;
  const labelStripH = 20;
  const chartH = 60 - padT - padB; // = 44
  const H = 60 + labelStripH;
  const labelY = padT + chartH + 14;

  const realValues = data.filter((v) => v > 0);
  const min = realValues.length > 0 ? Math.min(...realValues) : 0;
  const max = realValues.length > 0 ? Math.max(...realValues) : 1;
  const yMin = min - 0.5;
  const yMax = max + 0.5;
  const yRange = yMax - yMin || 1;

  const xFor = (i: number) => (i / (data.length - 1)) * width;
  const yFor = (v: number) => padT + (1 - (v - yMin) / yRange) * chartH;

  const realPoints = data
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => v > 0)
    .map(({ v, i }) => ({ x: xFor(i), y: yFor(v), i }));

  const linePoints = realPoints.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <Svg width={width} height={H}>
      {realPoints.length >= 2 && (
        <Polyline
          points={linePoints}
          stroke={t.teal}
          strokeWidth={2}
          fill="none"
        />
      )}
      {realPoints.map((p) => {
        const isLast = p.i === data.length - 1;
        return (
          <Circle
            key={p.i}
            cx={p.x}
            cy={p.y}
            r={isLast ? 5 : 3}
            fill={isLast ? t.teal : t.textTer}
          />
        );
      })}
      {labels.map((day, i) => (
        <SvgText
          key={i}
          x={xFor(i)}
          y={labelY}
          fontSize={10}
          fill={t.textTer}
          textAnchor="middle"
        >
          {day}
        </SvgText>
      ))}
    </Svg>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────
export default function LogWeight() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const { user } = useAuth();
  const [weight, setWeight] = useState('');
  const [unit, setUnit] = useState<Unit>('lbs');
  const [note, setNote] = useState('');
  const [recentWeights, setRecentWeights] = useState<WeightEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const chartWidth = screenW - 2 * space.xl;
  const todayLabel = formatTodayLong();

  useEffect(() => {
    if (!user) return;
    getWeightEntries(user.id, 7).then(setRecentWeights).catch(console.error);
  }, [user]);

  const sparklineData = recentWeights
    .slice()
    .map((e) => Number(e.weight_kg) * (unit === 'lbs' ? 2.20462 : 1));

  const paddedData = [
    ...Array(Math.max(0, 7 - sparklineData.length)).fill(0),
    ...sparklineData,
  ];

  const handleLog = async () => {
    if (!user || !weight) return;
    setSaving(true);
    try {
      const weightKg =
        unit === 'lbs' ? Number(weight) * 0.453592 : Number(weight);
      await addWeightEntry({
        user_id: user.id,
        logged_at: new Date().toISOString(),
        weight_kg: weightKg,
        note: note.trim() || null,
      });
      toast.show(`${weight} ${unit} logged`, 'success');
      setTimeout(() => router.back(), 800);
    } catch {
      toast.show('Could not save weight. Try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const logDisabled = saving || !weight;

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
            Log weight
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
            paddingTop: space.xxl,
            paddingBottom: space.xl,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Weight input + unit label */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              justifyContent: 'center',
            }}
          >
            <TextInput
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
              returnKeyType="done"
              placeholder="0.0"
              placeholderTextColor={t.textTer}
              style={{
                fontSize: 34,
                lineHeight: 41,
                fontWeight: '700',
                letterSpacing: 0.37,
                color: t.text,
                textAlign: 'center',
                minWidth: 80,
                padding: 0,
              }}
            />
            <Text
              style={[
                typo.title2,
                { color: t.textSec, marginLeft: space.sm },
              ]}
            >
              {unit}
            </Text>
          </View>

          {/* lbs / kg toggle */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              gap: space.sm,
              marginTop: space.md,
            }}
          >
            {(['lbs', 'kg'] as Unit[]).map((u) => {
              const selected = u === unit;
              return (
                <Pressable
                  key={u}
                  onPress={() => setUnit(u)}
                  style={({ pressed }) => ({
                    backgroundColor: selected ? t.primary : t.surface2,
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
                        color: selected ? t.textOnPrim : t.textSec,
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

          {/* Date row */}
          <Pressable
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 14,
              marginTop: space.xl,
              borderTopWidth: 0.5,
              borderTopColor: t.hairline,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text style={[typo.subhead, { color: t.textSec }]}>Date</Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Text style={[typo.subhead, { color: t.text }]}>
                {todayLabel}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={t.textTer}
              />
            </View>
          </Pressable>

          {/* Date / Note separator */}
          <View
            style={{ height: 0.5, backgroundColor: t.hairline }}
          />

          {/* Note row */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 14,
              gap: space.md,
            }}
          >
            <Text style={[typo.subhead, { color: t.textSec }]}>Note</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Optional note…"
              placeholderTextColor={t.textTer}
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

          {/* Sparkline */}
          <View style={{ marginTop: space.xl }}>
            <Text
              style={[
                typo.caption2,
                {
                  color: t.textTer,
                  letterSpacing: 0.06,
                  textTransform: 'uppercase',
                  fontWeight: '700',
                  marginBottom: space.sm,
                },
              ]}
            >
              Recent
            </Text>
            <WeightSparkline width={chartWidth} data={paddedData} t={t} />
          </View>
        </ScrollView>

        {/* Log button */}
        <View
          style={{
            paddingHorizontal: space.xl,
            paddingTop: space.sm,
            paddingBottom: insets.bottom + space.md,
          }}
        >
          <Pressable
            onPress={handleLog}
            disabled={logDisabled}
            style={({ pressed }) => ({
              height: 52,
              borderRadius: radius.lg,
              backgroundColor: t.teal,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: logDisabled ? 0.4 : pressed ? 0.85 : 1,
            })}
          >
            {saving ? (
              <ActivityIndicator color={t.textOnPrim} />
            ) : (
              <Text style={[typo.headline, { color: t.textOnPrim }]}>
                Log weight
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
