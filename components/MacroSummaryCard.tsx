import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { radius, space, type as typo, useTheme } from '../lib/theme';

type Props = {
  consumed: number;
  target: number;
  protein: { cur: number; target: number };
  carbs: { cur: number; target: number };
  fat: { cur: number; target: number };
};

type MacroView = 'consumed' | 'remaining';

function MacroRing({
  label,
  consumed,
  target,
  color,
  view,
  onToggle,
  size = 90,
}: {
  label: string;
  consumed: number;
  target: number;
  color: string;
  view: MacroView;
  onToggle: () => void;
  size?: number;
}) {
  const t = useTheme();
  const strokeWidth = 8;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = target > 0 ? Math.min(1, consumed / target) : 0;
  const strokeDashoffset = circumference * (1 - progress);
  const remaining = Math.max(0, Math.round(target - consumed));
  const displayValue =
    view === 'consumed' ? Math.round(consumed) : remaining;
  const isOver = consumed > target;

  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => ({
        alignItems: 'center',
        gap: 6,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{ width: size, height: size }}>
        <Svg
          width={size}
          height={size}
          style={{ transform: [{ rotate: '-90deg' }] }}
        >
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={t.surface2}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={isOver ? t.danger : color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </Svg>
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
          <Text
            style={{
              fontSize: 16,
              fontWeight: '700',
              color: isOver ? t.danger : t.text,
            }}
          >
            {displayValue}
          </Text>
          <Text style={{ fontSize: 10, color: t.textTer }}>g</Text>
        </View>
      </View>
      <Text style={[typo.caption1, { color: t.textSec, fontWeight: '600' }]}>
        {label}
      </Text>
      <Text style={[typo.caption2, { color: t.textTer }]}>
        {view === 'consumed'
          ? `of ${Math.round(target)}g`
          : `${remaining}g left`}
      </Text>
    </Pressable>
  );
}

function CalorieBar({
  pct,
  fill,
  track,
}: {
  pct: number;
  fill: string;
  track: string;
}) {
  const clamped = Math.max(0, Math.min(1, pct));
  return (
    <View
      style={{
        height: 8,
        backgroundColor: track,
        borderRadius: radius.pill,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          height: '100%',
          width: `${clamped * 100}%`,
          backgroundColor: fill,
          borderRadius: radius.pill,
        }}
      />
    </View>
  );
}

export default function MacroSummaryCard({
  consumed,
  target,
  protein,
  carbs,
  fat,
}: Props) {
  const t = useTheme();
  const over = consumed > target;
  const remaining = Math.abs(target - consumed);
  const pct = target > 0 ? consumed / target : 0;
  const [macroView, setMacroView] = useState<MacroView>('consumed');
  const toggle = () =>
    setMacroView((v) => (v === 'consumed' ? 'remaining' : 'consumed'));

  return (
    <View
      style={{
        backgroundColor: t.surface,
        borderRadius: radius.lg,
        padding: space.lg,
        borderWidth: 1,
        borderColor: t.separator,
      }}
    >
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
        Calories
      </Text>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          marginTop: space.xs,
        }}
      >
        <View>
          <Text
            style={{
              fontSize: 52,
              lineHeight: 56,
              fontWeight: '800',
              color: t.text,
              letterSpacing: -2,
              fontVariant: ['tabular-nums'],
            }}
          >
            {consumed.toLocaleString()}
          </Text>
          <Text style={[typo.subhead, { color: t.textSec, marginTop: 2 }]}>
            {`of ${target.toLocaleString()} kcal`}
          </Text>
        </View>
        <Text
          style={[
            typo.title3,
            {
              color: over ? t.danger : t.success,
              fontWeight: '700',
              fontVariant: ['tabular-nums'],
              textAlign: 'right',
              maxWidth: 140,
            },
          ]}
        >
          {`${remaining.toLocaleString()} ${over ? 'over' : 'remaining'}`}
        </Text>
      </View>

      <View style={{ marginTop: space.md }}>
        <CalorieBar
          pct={pct}
          fill={over ? t.danger : t.primary}
          track={t.surface2}
        />
      </View>

      <View
        style={{
          height: 1,
          backgroundColor: t.separator,
          marginTop: space.lg,
          marginBottom: space.md,
        }}
      />

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-around',
          paddingVertical: space.md,
        }}
      >
        <MacroRing
          label="Protein"
          consumed={protein.cur}
          target={protein.target}
          color={t.protein}
          view={macroView}
          onToggle={toggle}
        />
        <MacroRing
          label="Carbs"
          consumed={carbs.cur}
          target={carbs.target}
          color={t.carbs}
          view={macroView}
          onToggle={toggle}
        />
        <MacroRing
          label="Fat"
          consumed={fat.cur}
          target={fat.target}
          color={t.fat}
          view={macroView}
          onToggle={toggle}
        />
      </View>
    </View>
  );
}
