import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import Svg, {
  Circle,
  G,
  Line,
  Polygon,
  Polyline,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
import { radius, space, type as typo, useTheme, type Theme } from '../../lib/theme';
import { useAuth } from '../../lib/AuthContext';
import {
  calculateMomentumScore,
  getCurrentMacroTarget,
  getFeelingEntriesForDateRange,
  getFoodEntriesForDateRange,
  getWeightEntries,
} from '../../lib/db';
import type {
  FeelingEntry,
  FoodEntry,
  MacroTarget,
  WeightEntry,
} from '../../lib/types';

const CAL_TARGET = 2000;
const CARD_MARGIN_H = space.lg;
const CARD_PADDING = space.lg;

const DEFAULT_TARGET_SPLIT = { protein: 30, carbs: 45, fat: 25 };

const RANGES = ['7D', '30D', '90D', 'All'] as const;
type Range = (typeof RANGES)[number];

// ── Layout primitives ────────────────────────────────────────────────────────
function Card({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View
      style={{
        backgroundColor: t.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: t.hairline,
        padding: CARD_PADDING,
        marginHorizontal: CARD_MARGIN_H,
        marginTop: space.md,
      }}
    >
      {children}
    </View>
  );
}

function CardHeader({ title, right }: { title: string; right?: string }) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: space.md,
      }}
    >
      <Text style={[typo.subheadEm, { color: t.text }]}>{title}</Text>
      {right && (
        <Text style={[typo.footnote, { color: t.textSec }]}>{right}</Text>
      )}
    </View>
  );
}

function LockedChart({
  children,
  message,
}: {
  children: React.ReactNode;
  message: string;
}) {
  const t = useTheme();
  return (
    <View style={{ position: 'relative' }}>
      <View style={{ opacity: 0.15 }}>{children}</View>
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons
          name="lock-closed-outline"
          size={24}
          color={t.textTer}
        />
        <Text
          style={[
            typo.footnote,
            {
              color: t.textTer,
              marginTop: space.sm,
              textAlign: 'center',
              paddingHorizontal: space.md,
            },
          ]}
        >
          {message}
        </Text>
      </View>
    </View>
  );
}

// ── Segmented control ────────────────────────────────────────────────────────
function SegmentedControl({
  value,
  onChange,
}: {
  value: Range;
  onChange: (r: Range) => void;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: t.surface2,
        borderRadius: radius.lg,
        padding: 3,
        marginHorizontal: space.xl,
        marginTop: space.md,
      }}
    >
      {RANGES.map((r) => {
        const selected = r === value;
        return (
          <Pressable
            key={r}
            onPress={() => onChange(r)}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: 8,
              borderRadius: radius.md,
              backgroundColor: selected ? t.surface : 'transparent',
              alignItems: 'center',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text
              style={[
                typo.subheadEm,
                { color: selected ? t.text : t.textTer },
              ]}
            >
              {r}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Short month/day formatter for x-axis labels: '2026-05-12' → 'May 12'.
function shortDayLabel(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Decide which label indices to render so the strip never overcrowds.
function pickLabelIndices(count: number): number[] {
  if (count <= 0) return [];
  if (count <= 7) return Array.from({ length: count }, (_, i) => i);
  return [0, count - 1];
}

// ── Calorie chart ────────────────────────────────────────────────────────────
function CalorieChart({
  width,
  t,
  data,
  labels,
}: {
  width: number;
  t: Theme;
  data: number[];
  labels: string[];
}) {
  const labelStripH = 20;
  const H = 120 + labelStripH;
  const padT = 8;
  const padB = 8;
  const chartH = H - padT - padB - labelStripH;
  const labelY = padT + chartH + 14;

  const safeData = data.length > 0 ? data : [CAL_TARGET];
  const yMin = Math.min(...safeData, CAL_TARGET) - 100;
  const yMax = Math.max(...safeData, CAL_TARGET) + 80;
  const yRange = yMax - yMin || 1;

  const xFor = (i: number) =>
    data.length <= 1 ? width / 2 : (i / (data.length - 1)) * width;
  const yFor = (v: number) => padT + (1 - (v - yMin) / yRange) * chartH;

  const linePoints = data.map((v, i) => `${xFor(i)},${yFor(v)}`).join(' ');
  const bottomY = padT + chartH;
  const areaPoints =
    data.length >= 2
      ? `${xFor(0)},${bottomY} ${linePoints} ${xFor(data.length - 1)},${bottomY}`
      : '';
  const targetY = yFor(CAL_TARGET);
  const labelIndices = pickLabelIndices(labels.length);

  return (
    <Svg width={width} height={H}>
      {areaPoints && <Polygon points={areaPoints} fill={t.primarySoft} />}
      <Line
        x1={0}
        y1={targetY}
        x2={width}
        y2={targetY}
        stroke={t.primary}
        strokeWidth={1}
        strokeOpacity={0.35}
        strokeDasharray="4 4"
      />
      {data.length >= 2 && (
        <Polyline
          points={linePoints}
          stroke={t.primary}
          strokeWidth={2}
          fill="none"
        />
      )}
      {data.map((v, i) => (
        <Circle
          key={i}
          cx={xFor(i)}
          cy={yFor(v)}
          r={3}
          fill={t.primary}
        />
      ))}
      {labelIndices.map((i) => (
        <SvgText
          key={i}
          x={xFor(i)}
          y={labelY}
          fontSize={10}
          fill={t.textTer}
          textAnchor="middle"
        >
          {shortDayLabel(labels[i])}
        </SvgText>
      ))}
    </Svg>
  );
}

// ── Weight chart ─────────────────────────────────────────────────────────────
function WeightChart({
  width,
  t,
  raw,
  smoothed,
  labels,
  goal,
}: {
  width: number;
  t: Theme;
  raw: number[];
  smoothed: number[];
  labels: string[];
  goal: number | null;
}) {
  const labelStripH = 20;
  const H = 120 + labelStripH;
  const padT = 10;
  const padB = 10;
  const chartH = H - padT - padB - labelStripH;
  const labelY = padT + chartH + 14;

  const fallback = goal !== null ? [goal] : [0, 1];
  const safeData = raw.length > 0 ? raw : fallback;
  const refValues = goal !== null ? [...safeData, goal] : safeData;
  const yMin = Math.min(...refValues) - 1;
  const yMax = Math.max(...refValues) + 1;
  const yRange = yMax - yMin || 1;

  const xFor = (i: number) =>
    raw.length <= 1 ? width / 2 : (i / (raw.length - 1)) * width;
  const yFor = (v: number) => padT + (1 - (v - yMin) / yRange) * chartH;

  const smoothedPoints = smoothed
    .map((v, i) => `${xFor(i)},${yFor(v)}`)
    .join(' ');
  const labelIndices = pickLabelIndices(labels.length);

  return (
    <Svg width={width} height={H}>
      {goal !== null && (
        <Line
          x1={0}
          y1={yFor(goal)}
          x2={width}
          y2={yFor(goal)}
          stroke={t.teal}
          strokeWidth={1}
          strokeOpacity={0.35}
          strokeDasharray="4 4"
        />
      )}
      {smoothed.length >= 2 && (
        <Polyline
          points={smoothedPoints}
          stroke={t.teal}
          strokeWidth={2.5}
          fill="none"
        />
      )}
      {raw.map((v, i) => (
        <Circle key={i} cx={xFor(i)} cy={yFor(v)} r={3} fill={t.textTer} />
      ))}
      {labelIndices.map((i) => (
        <SvgText
          key={i}
          x={xFor(i)}
          y={labelY}
          fontSize={10}
          fill={t.textTer}
          textAnchor="middle"
        >
          {shortDayLabel(labels[i])}
        </SvgText>
      ))}
    </Svg>
  );
}

// ── Donut chart ──────────────────────────────────────────────────────────────
type DonutSegment = {
  value: number;
  color: string;
  opacity?: number;
};

function donutSegments(
  cx: number,
  cy: number,
  r: number,
  strokeWidth: number,
  items: DonutSegment[],
) {
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return items.map((item, idx) => {
    const arcLen = (item.value / 100) * circ;
    const el = (
      <Circle
        key={idx}
        cx={cx}
        cy={cy}
        r={r}
        stroke={item.color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={`${arcLen} ${circ - arcLen}`}
        strokeDashoffset={-offset}
        strokeOpacity={item.opacity ?? 1}
      />
    );
    offset += arcLen;
    return el;
  });
}

type MacroSplit = { protein: number; carbs: number; fat: number };

function MacroDonut({
  size,
  t,
  actual,
  target,
}: {
  size: number;
  t: Theme;
  actual: MacroSplit;
  target: MacroSplit;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2 - 12;
  const rInner = rOuter - 18;

  return (
    <Svg width={size} height={size}>
      <G rotation={-90} originX={cx} originY={cy}>
        {donutSegments(cx, cy, rOuter, 18, [
          { value: actual.protein, color: t.protein },
          { value: actual.carbs, color: t.carbs },
          { value: actual.fat, color: t.fat },
        ])}
        {donutSegments(cx, cy, rInner, 10, [
          { value: target.protein, color: t.primarySoft },
          { value: target.carbs, color: t.warnSoft },
          { value: target.fat, color: t.tealSoft },
        ])}
      </G>
    </Svg>
  );
}

// ── Momentum bars ────────────────────────────────────────────────────────────
function MomentumBars({
  width,
  t,
  data,
  days,
}: {
  width: number;
  t: Theme;
  data: number[];
  days: string[];
}) {
  const labelStripH = 20;
  const H = 100 + labelStripH;
  const padT = 18;
  const padB = 8;
  const padL = 24;
  const maxBarH = H - padT - padB - labelStripH;
  const labelY = padT + maxBarH + 14;
  const plotW = width - padL;
  const colW = plotW / data.length;
  const barW = Math.max(4, colW * 0.55);

  const yFor = (score: number) =>
    padT + maxBarH - (score / 100) * maxBarH;

  const refScores = [40, 70, 100];

  return (
    <Svg width={width} height={H}>
      {refScores.map((s) => {
        const y = yFor(s);
        return (
          <G key={`ref-${s}`}>
            <Line
              x1={padL}
              y1={y}
              x2={width}
              y2={y}
              stroke={t.hairline}
              strokeWidth={0.5}
            />
            <SvgText
              x={18}
              y={y + 3}
              fontSize={9}
              fill={t.textTer}
              textAnchor="end"
            >
              {String(s)}
            </SvgText>
          </G>
        );
      })}

      {data.map((score, i) => {
        const h = (score / 100) * maxBarH;
        const x = padL + colW * i + (colW - barW) / 2;
        const y = padT + maxBarH - h;
        const color =
          score >= 71 ? t.success : score >= 41 ? t.warn : t.danger;
        return (
          <G key={i}>
            <Rect
              x={x}
              y={y}
              width={barW}
              height={h}
              rx={3}
              fill={color}
            />
            {score >= 15 && (
              <SvgText
                x={x + barW / 2}
                y={y - 6}
                fontSize={10}
                fill={t.textTer}
                textAnchor="middle"
              >
                {String(score)}
              </SvgText>
            )}
          </G>
        );
      })}

      {days.map((day, i) => (
        <SvgText
          key={day}
          x={padL + colW * i + colW / 2}
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

// ── Energy & hunger chart ────────────────────────────────────────────────────
type DailyFeeling = {
  day: string;
  energy: number | null;
  hunger: number | null;
};

function EnergyHungerChart({
  width,
  t,
  data,
}: {
  width: number;
  t: Theme;
  data: DailyFeeling[];
}) {
  const labelStripH = 20;
  const H = 100 + labelStripH;
  const padT = 10;
  const padB = 10;
  const chartH = H - padT - padB - labelStripH;
  const labelY = padT + chartH + 14;
  const yMin = 0;
  const yMax = 5;
  const yRange = yMax - yMin || 1;

  const xFor = (i: number) =>
    data.length <= 1 ? width / 2 : (i / (data.length - 1)) * width;
  const yFor = (v: number) => padT + (1 - (v - yMin) / yRange) * chartH;

  const energyPoints = data
    .map((d, i) => ({ i, v: d.energy }))
    .filter((p): p is { i: number; v: number } => p.v !== null);
  const hungerPoints = data
    .map((d, i) => ({ i, v: d.hunger }))
    .filter((p): p is { i: number; v: number } => p.v !== null);

  const energyPolyline = energyPoints
    .map((p) => `${xFor(p.i)},${yFor(p.v)}`)
    .join(' ');
  const hungerPolyline = hungerPoints
    .map((p) => `${xFor(p.i)},${yFor(p.v)}`)
    .join(' ');

  const labels = data.map((d) => d.day);
  const labelIndices = pickLabelIndices(labels.length);

  return (
    <Svg width={width} height={H}>
      {energyPoints.length >= 2 && (
        <Polyline
          points={energyPolyline}
          stroke={t.teal}
          strokeWidth={2}
          fill="none"
        />
      )}
      {energyPoints.map((p) => (
        <Circle
          key={`e-${p.i}`}
          cx={xFor(p.i)}
          cy={yFor(p.v)}
          r={3}
          fill={t.teal}
        />
      ))}
      {hungerPoints.length >= 2 && (
        <Polyline
          points={hungerPolyline}
          stroke={t.warn}
          strokeWidth={2}
          fill="none"
        />
      )}
      {hungerPoints.map((p) => (
        <Circle
          key={`h-${p.i}`}
          cx={xFor(p.i)}
          cy={yFor(p.v)}
          r={3}
          fill={t.warn}
        />
      ))}
      {labelIndices.map((i) => (
        <SvgText
          key={i}
          x={xFor(i)}
          y={labelY}
          fontSize={10}
          fill={t.textTer}
          textAnchor="middle"
        >
          {shortDayLabel(labels[i])}
        </SvgText>
      ))}
    </Svg>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function LegendDot({ color, label }: { color: string; label: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: color,
        }}
      />
      <Text style={[typo.caption2, { color: t.textSec }]}>{label}</Text>
    </View>
  );
}

function getRangeStartDate(range: Range): Date {
  const now = new Date();
  if (range === '7D') return new Date(now.setDate(now.getDate() - 7));
  if (range === '30D') return new Date(now.setDate(now.getDate() - 30));
  if (range === '90D') return new Date(now.setDate(now.getDate() - 90));
  return new Date(2020, 0, 1);
}

function getSmoothedWeight(data: number[], alpha = 0.3): number[] {
  if (data.length === 0) return [];
  const smoothed = [data[0]];
  for (let i = 1; i < data.length; i++) {
    smoothed.push(alpha * data[i] + (1 - alpha) * smoothed[i - 1]);
  }
  return smoothed;
}

// ── Screen ───────────────────────────────────────────────────────────────────
export default function Trends() {
  const t = useTheme();
  const { width: screenW } = useWindowDimensions();
  const { user, profile } = useAuth();

  const [selectedRange, setSelectedRange] = useState<Range>('7D');
  const [foodEntries, setFoodEntries] = useState<FoodEntry[]>([]);
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([]);
  const [feelingEntries, setFeelingEntries] = useState<FeelingEntry[]>([]);
  const [macroTarget, setMacroTarget] = useState<MacroTarget | null>(null);
  const [momentumScore, setMomentumScore] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadTrendsData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const startDate = getRangeStartDate(selectedRange);
      const endDate = new Date();
      const weightDays =
        selectedRange === '7D'
          ? 7
          : selectedRange === '30D'
            ? 30
            : selectedRange === '90D'
              ? 90
              : 365;
      const [food, weight, feeling, target, score] = await Promise.all([
        getFoodEntriesForDateRange(user.id, startDate, endDate),
        getWeightEntries(user.id, weightDays),
        getFeelingEntriesForDateRange(user.id, startDate, endDate),
        getCurrentMacroTarget(user.id),
        calculateMomentumScore(user.id, profile?.goal ?? 'maintain'),
      ]);
      setFoodEntries(food);
      setWeightEntries(weight);
      setFeelingEntries(feeling);
      setMacroTarget(target);
      setMomentumScore(score);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      void loadTrendsData();
      // loadTrendsData closure refreshes whenever user/selectedRange changes.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, selectedRange]),
  );

  const chartW = screenW - 2 * CARD_MARGIN_H - 2 * CARD_PADDING;
  const weightUnit: 'lbs' | 'kg' = profile?.is_metric ? 'kg' : 'lbs';

  // Group food entries by day and compute daily calorie totals
  const getDailyCalories = (): { day: string; cal: number }[] => {
    const byDay: Record<string, number> = {};
    foodEntries.forEach((e) => {
      const day = new Date(e.logged_at).toLocaleDateString('en-CA');
      byDay[day] = (byDay[day] ?? 0) + e.calories;
    });
    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, cal]) => ({ day, cal }));
  };

  const dailyCalories = getDailyCalories();
  const totalDays = dailyCalories.length;
  const totalCal = dailyCalories.reduce((s, d) => s + d.cal, 0);
  const totalP = foodEntries.reduce((s, e) => s + Number(e.protein_g), 0);
  const totalC = foodEntries.reduce((s, e) => s + Number(e.carbs_g), 0);
  const totalF = foodEntries.reduce((s, e) => s + Number(e.fat_g), 0);
  const avgCal = totalDays === 0 ? 0 : Math.round(totalCal / totalDays);

  const weightChartData = weightEntries.map((e) => ({
    day: new Date(e.logged_at).toLocaleDateString('en-US', {
      weekday: 'short',
    }),
    weight: Number(e.weight_kg) * (profile?.is_metric ? 1 : 2.20462),
  }));
  const weightSeries = weightChartData.map((d) => d.weight);
  const smoothedWeightSeries = getSmoothedWeight(weightSeries);
  const weightLabels = weightEntries.map((e) =>
    new Date(e.logged_at).toLocaleDateString('en-CA'),
  );
  const currentWeight =
    weightSeries.length > 0 ? weightSeries[weightSeries.length - 1] : null;

  // Goal reference line in the user's preferred unit. Null when the user
  // hasn't set a goal weight; in that case the chart skips the dashed line.
  const weightGoalInUnit: number | null = profile?.goal_weight_kg
    ? profile.is_metric
      ? profile.goal_weight_kg
      : profile.goal_weight_kg * 2.20462
    : null;

  // Energy and hunger daily averages
  const getDailyFeelings = (): DailyFeeling[] => {
    const byDay: Record<string, { energy: number[]; hunger: number[] }> = {};
    feelingEntries.forEach((e) => {
      const day = new Date(e.logged_at).toLocaleDateString('en-CA');
      if (!byDay[day]) byDay[day] = { energy: [], hunger: [] };
      if (e.energy) byDay[day].energy.push(e.energy);
      if (e.hunger) byDay[day].hunger.push(e.hunger);
    });
    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, vals]) => ({
        day,
        energy: vals.energy.length
          ? vals.energy.reduce((s, v) => s + v, 0) / vals.energy.length
          : null,
        hunger: vals.hunger.length
          ? vals.hunger.reduce((s, v) => s + v, 0) / vals.hunger.length
          : null,
      }));
  };

  const dailyFeelings = getDailyFeelings();

  const hasEnoughData = dailyCalories.length >= 3;
  const hasFeelingData = feelingEntries.length > 0;
  const DAYS_TO_UNLOCK = Math.max(0, 3 - dailyCalories.length);

  // Per-day momentum approximation for the bars: ratio of logged calories
  // to target, clamped to 100. The card header displays the real 7-day
  // composite via calculateMomentumScore.
  const last7DayKeys = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toLocaleDateString('en-CA');
  });
  const last7DayLabels = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toLocaleDateString('en-US', { weekday: 'short' });
  });
  const dailyCalLookup: Record<string, number> = {};
  foodEntries.forEach((e) => {
    const day = new Date(e.logged_at).toLocaleDateString('en-CA');
    dailyCalLookup[day] = (dailyCalLookup[day] ?? 0) + e.calories;
  });
  const targetCalForMomentum = macroTarget?.calories ?? CAL_TARGET;
  const momentumData = last7DayKeys.map((day) => {
    const cal = dailyCalLookup[day] ?? 0;
    if (cal === 0) return 0;
    const ratio = Math.min(1, cal / targetCalForMomentum);
    return Math.round(ratio * 100);
  });

  // Approximate per-period macro grams (only meaningful when we have data)
  const avgP = totalDays === 0 ? 0 : Math.round(totalP / totalDays);
  const avgC = totalDays === 0 ? 0 : Math.round(totalC / totalDays);
  const avgF = totalDays === 0 ? 0 : Math.round(totalF / totalDays);

  // Calorie share of each macro for the donut's outer ring (actual intake).
  // Falls back to DEFAULT_TARGET_SPLIT when there are no calories logged yet.
  const proteinPct =
    avgCal > 0 ? Math.round(((avgP * 4) / avgCal) * 100) : DEFAULT_TARGET_SPLIT.protein;
  const carbsPct =
    avgCal > 0 ? Math.round(((avgC * 4) / avgCal) * 100) : DEFAULT_TARGET_SPLIT.carbs;
  const fatPct =
    avgCal > 0 ? Math.round(((avgF * 9) / avgCal) * 100) : DEFAULT_TARGET_SPLIT.fat;
  const actualSplit = { protein: proteinPct, carbs: carbsPct, fat: fatPct };

  // Target ring driven by the user's MacroTarget if set; otherwise default.
  const targetSplit =
    macroTarget && macroTarget.calories > 0
      ? {
          protein: Math.round((macroTarget.protein_g * 4 / macroTarget.calories) * 100),
          carbs: Math.round((macroTarget.carbs_g * 4 / macroTarget.calories) * 100),
          fat: Math.round((macroTarget.fat_g * 9 / macroTarget.calories) * 100),
        }
      : DEFAULT_TARGET_SPLIT;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: t.bg }}
      edges={['top', 'left', 'right']}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: space.xxxl }}
      >
        {/* Header */}
        <View
          style={{
            paddingHorizontal: space.xl,
            paddingTop: space.lg,
          }}
        >
          <Text style={[typo.largeTitle, { color: t.text }]}>Trends</Text>
        </View>

        {/* Time range selector */}
        <SegmentedControl value={selectedRange} onChange={setSelectedRange} />

        {loading ? (
          <View
            style={{
              alignItems: 'center',
              paddingVertical: space.xxxl,
            }}
          >
            <ActivityIndicator color={t.primary} />
          </View>
        ) : (
          <>
            {/* Calorie trend card */}
            <Card>
              <CardHeader
                title="Calories"
                right={`Avg ${avgCal.toLocaleString()} kcal`}
              />
              {hasEnoughData ? (
                <>
                  <CalorieChart
                    width={chartW}
                    t={t}
                    data={dailyCalories.map((d) => d.cal)}
                    labels={dailyCalories.map((d) => d.day)}
                  />
                  <View
                    style={{
                      flexDirection: 'row',
                      gap: space.md,
                      marginTop: space.sm,
                    }}
                  >
                    <LegendDot color={t.primary} label="Daily intake" />
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <View
                        style={{
                          width: 12,
                          height: 0,
                          borderTopWidth: 1,
                          borderTopColor: t.primary,
                          borderStyle: 'dashed',
                          opacity: 0.5,
                        }}
                      />
                      <Text style={[typo.caption2, { color: t.textSec }]}>
                        {`Target ${CAL_TARGET.toLocaleString()}`}
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={[
                      typo.footnote,
                      { color: t.textSec, marginTop: space.sm },
                    ]}
                  >
                    {`Avg this period: ${avgCal.toLocaleString()} kcal`}
                  </Text>
                </>
              ) : (
                <LockedChart
                  message={`Log for ${DAYS_TO_UNLOCK} more days to unlock`}
                >
                  <CalorieChart
                    width={chartW}
                    t={t}
                    data={dailyCalories.map((d) => d.cal)}
                    labels={dailyCalories.map((d) => d.day)}
                  />
                </LockedChart>
              )}
            </Card>

            {/* Weight trend card */}
            <Card>
              <CardHeader
                title="Weight"
                right={
                  weightGoalInUnit !== null
                    ? `Goal: ${Math.round(weightGoalInUnit)} ${weightUnit}`
                    : undefined
                }
              />
              {hasEnoughData ? (
                <>
                  <WeightChart
                    width={chartW}
                    t={t}
                    raw={weightSeries}
                    smoothed={smoothedWeightSeries}
                    labels={weightLabels}
                    goal={weightGoalInUnit}
                  />
                  <View
                    style={{
                      flexDirection: 'row',
                      gap: space.sm,
                      marginTop: space.md,
                    }}
                  >
                    <View
                      style={{
                        flex: 1,
                        backgroundColor: t.tealSoft,
                        borderRadius: radius.md,
                        paddingHorizontal: space.md,
                        paddingVertical: space.sm,
                      }}
                    >
                      <Text
                        style={[
                          typo.caption2,
                          {
                            color: t.teal,
                            letterSpacing: 0.06,
                            textTransform: 'uppercase',
                            fontWeight: '700',
                          },
                        ]}
                      >
                        Trend
                      </Text>
                      <Text
                        style={[
                          typo.subheadEm,
                          { color: t.teal, marginTop: 2 },
                        ]}
                      >
                        {`−0.5 ${weightUnit} / week`}
                      </Text>
                    </View>
                    <View
                      style={{
                        flex: 1,
                        backgroundColor: t.surface2,
                        borderRadius: radius.md,
                        paddingHorizontal: space.md,
                        paddingVertical: space.sm,
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
                        Goal
                      </Text>
                      <Text
                        style={[
                          typo.subheadEm,
                          { color: t.textSec, marginTop: 2 },
                        ]}
                      >
                        Est. 9 weeks to goal
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={[
                      typo.footnote,
                      { color: t.textSec, marginTop: space.sm },
                    ]}
                  >
                    {currentWeight !== null
                      ? `Current: ${currentWeight.toFixed(1)} ${weightUnit}`
                      : 'No weight entries yet'}
                  </Text>
                </>
              ) : (
                <LockedChart
                  message={`Weigh in for ${DAYS_TO_UNLOCK} more days to unlock`}
                >
                  <WeightChart
                    width={chartW}
                    t={t}
                    raw={weightSeries}
                    smoothed={smoothedWeightSeries}
                    labels={weightLabels}
                    goal={weightGoalInUnit}
                  />
                </LockedChart>
              )}
            </Card>

            {/* Macro split card */}
            <Card>
              <CardHeader title="Macro split" right="Period average" />
              {hasEnoughData ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.lg,
                  }}
                >
                  <MacroDonut
                    size={140}
                    t={t}
                    actual={actualSplit}
                    target={targetSplit}
                  />
                  <View style={{ flex: 1, gap: space.sm }}>
                    {[
                      {
                        name: 'Protein',
                        pct: proteinPct,
                        color: t.protein,
                        grams: avgP,
                      },
                      {
                        name: 'Carbs',
                        pct: carbsPct,
                        color: t.carbs,
                        grams: avgC,
                      },
                      {
                        name: 'Fat',
                        pct: fatPct,
                        color: t.fat,
                        grams: avgF,
                      },
                    ].map((row) => (
                      <View
                        key={row.name}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: space.sm,
                        }}
                      >
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: row.color,
                          }}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={[typo.subhead, { color: t.text }]}>
                            {row.name}
                          </Text>
                          <Text
                            style={[typo.caption2, { color: t.textTer }]}
                          >
                            {`${row.grams}g`}
                          </Text>
                        </View>
                        <Text
                          style={[typo.subheadEm, { color: row.color }]}
                        >
                          {`${row.pct}%`}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : (
                <LockedChart
                  message={`Log for ${DAYS_TO_UNLOCK} more days to unlock`}
                >
                  <View style={{ alignItems: 'center' }}>
                    <MacroDonut
                      size={140}
                      t={t}
                      actual={actualSplit}
                      target={targetSplit}
                    />
                  </View>
                </LockedChart>
              )}
            </Card>

            {/* Momentum score card */}
            <Card>
              <CardHeader
                title="Momentum score"
                right={`7-day avg: ${momentumScore}`}
              />
              {hasEnoughData ? (
                <MomentumBars
                  width={chartW}
                  t={t}
                  data={momentumData}
                  days={last7DayLabels}
                />
              ) : (
                <LockedChart
                  message={`Log consistently for ${DAYS_TO_UNLOCK} more days to unlock`}
                >
                  <MomentumBars
                    width={chartW}
                    t={t}
                    data={momentumData}
                    days={last7DayLabels}
                  />
                </LockedChart>
              )}
            </Card>

            {/* Energy & hunger card */}
            <Card>
              <CardHeader title="Energy & hunger" />
              {hasFeelingData ? (
                <>
                  <EnergyHungerChart
                    width={chartW}
                    t={t}
                    data={dailyFeelings}
                  />
                  <View
                    style={{
                      flexDirection: 'row',
                      gap: space.md,
                      marginTop: space.sm,
                    }}
                  >
                    <LegendDot color={t.teal} label="Energy" />
                    <LegendDot color={t.warn} label="Hunger" />
                  </View>
                </>
              ) : (
                <View
                  style={{
                    alignItems: 'center',
                    paddingVertical: space.xl,
                  }}
                >
                  <Ionicons
                    name="happy-outline"
                    size={32}
                    color={t.textTer}
                  />
                  <Text
                    style={[
                      typo.footnote,
                      { color: t.textTer, marginTop: space.sm },
                    ]}
                  >
                    No journal data yet
                  </Text>
                  <Text
                    style={[
                      typo.caption1,
                      {
                        color: t.textTer,
                        marginTop: 4,
                        textAlign: 'center',
                      },
                    ]}
                  >
                    Log your energy and hunger from the Today tab.
                  </Text>
                </View>
              )}
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
