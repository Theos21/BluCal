import { View, Text } from 'react-native';
import { radius, space, type as typo, useTheme } from '../lib/theme';

type MacroRow = { label: string; cur: number; target: number; color: string };

type Props = {
  consumed: number;
  target: number;
  protein: { cur: number; target: number };
  carbs: { cur: number; target: number };
  fat: { cur: number; target: number };
};

function ProgressBar({
  pct,
  height,
  track,
  fill,
}: {
  pct: number;
  height: number;
  track: string;
  fill: string;
}) {
  const clamped = Math.max(0, Math.min(1, pct));
  return (
    <View
      style={{
        height,
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

function MacroBarRow({ row }: { row: MacroRow }) {
  const t = useTheme();
  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 6,
        }}
      >
        <Text style={[typo.subheadEm, { color: t.text }]}>{row.label}</Text>
        <Text style={[typo.caption1, { color: t.textSec }]}>
          <Text
            style={{
              color: t.text,
              fontWeight: '700',
              fontVariant: ['tabular-nums'],
            }}
          >
            {row.cur}g
          </Text>
          {` / ${row.target}g`}
        </Text>
      </View>
      <ProgressBar
        pct={row.cur / row.target}
        height={8}
        track={t.surface2}
        fill={row.color}
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
        <ProgressBar
          pct={pct}
          height={8}
          track={t.surface2}
          fill={over ? t.danger : t.primary}
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

      <View style={{ gap: space.md }}>
        <MacroBarRow
          row={{
            label: 'Protein',
            cur: protein.cur,
            target: protein.target,
            color: t.protein,
          }}
        />
        <MacroBarRow
          row={{
            label: 'Carbs',
            cur: carbs.cur,
            target: carbs.target,
            color: t.carbs,
          }}
        />
        <MacroBarRow
          row={{
            label: 'Fat',
            cur: fat.cur,
            target: fat.target,
            color: t.fat,
          }}
        />
      </View>
    </View>
  );
}
