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

function MiniMacro({ row }: { row: MacroRow }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: space.xs,
        }}
      >
        <Text style={[typo.subheadEm, { color: t.text }]}>{row.label}</Text>
        <Text style={[typo.caption1, { color: t.textSec }]}>
          <Text style={{ color: t.text, fontWeight: '700' }}>{row.cur}</Text>
          {` / ${row.target}g`}
        </Text>
      </View>
      <ProgressBar
        pct={row.cur / row.target}
        height={4}
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
  const remaining = Math.max(0, target - consumed);
  const pct = consumed / target;

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
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <View>
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
              alignItems: 'baseline',
              marginTop: space.xs,
            }}
          >
            <Text
              style={[
                typo.title1,
                { color: t.text, fontVariant: ['tabular-nums'] },
              ]}
            >
              {consumed.toLocaleString()}
            </Text>
            <Text style={[typo.body, { color: t.textSec, marginLeft: space.xs }]}>
              {`/ ${target.toLocaleString()}`}
            </Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
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
            Remaining
          </Text>
          <Text
            style={[
              typo.title3,
              {
                color: t.textSec,
                marginTop: space.xs,
                fontVariant: ['tabular-nums'],
              },
            ]}
          >
            {remaining.toLocaleString()}
          </Text>
        </View>
      </View>

      <View style={{ marginTop: space.md }}>
        <ProgressBar pct={pct} height={6} track={t.surface2} fill={t.primary} />
      </View>

      <View
        style={{
          height: 1,
          backgroundColor: t.separator,
          marginTop: space.lg,
          marginBottom: space.md,
        }}
      />

      <View style={{ flexDirection: 'row', gap: space.md }}>
        <MiniMacro
          row={{
            label: 'Protein',
            cur: protein.cur,
            target: protein.target,
            color: t.protein,
          }}
        />
        <MiniMacro
          row={{
            label: 'Carbs',
            cur: carbs.cur,
            target: carbs.target,
            color: t.carbs,
          }}
        />
        <MiniMacro
          row={{ label: 'Fat', cur: fat.cur, target: fat.target, color: t.fat }}
        />
      </View>
    </View>
  );
}
