import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { radius, type as typo, useTheme } from '../lib/theme';
import type { MealGroup } from '../lib/groupEntries';
import type { FoodEntry } from '../lib/types';

type Props = {
  group: MealGroup;
  readOnly?: boolean;
  // When set (past days), tapping a row calls this instead of navigating to
  // the editable entry-detail screen.
  onReadOnlyPress?: (item: FoodEntry) => void;
};

export default function MealGroupCard({
  group,
  readOnly,
  onReadOnlyPress,
}: Props) {
  const t = useTheme();

  return (
    <View
      style={{
        backgroundColor: t.surface,
        borderRadius: radius.lg,
        borderWidth: 0.5,
        borderColor: t.hairline,
        overflow: 'hidden',
      }}
    >
      {/* Group header */}
      <View
        style={{
          paddingHorizontal: 12,
          paddingVertical: 10,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text
          style={[
            typo.footnote,
            { fontWeight: '600', color: t.textSec },
          ]}
        >
          {group.time}
        </Text>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[typo.subheadEm, { color: t.text }]}>
            {Math.round(group.totalCal)}
          </Text>
          <Text
            style={[
              typo.caption2,
              { color: t.textTer, marginTop: 2, fontVariant: ['tabular-nums'] },
            ]}
          >
            <Text style={{ color: t.protein, fontWeight: '600' }}>
              {Math.round(group.totalP)}
            </Text>
            p
            <Text>{' · '}</Text>
            <Text style={{ color: t.carbs, fontWeight: '600' }}>
              {Math.round(group.totalC)}
            </Text>
            c
            <Text>{' · '}</Text>
            <Text style={{ color: t.fat, fontWeight: '600' }}>
              {Math.round(group.totalF)}
            </Text>
            f
          </Text>
        </View>
      </View>

      {/* Header / items separator */}
      <View style={{ height: 0.5, backgroundColor: t.hairline }} />

      {/* Items */}
      {group.items.map((item, i) => {
        const isLast = i === group.items.length - 1;
        return (
          <View key={item.id}>
            <Pressable
              onPress={() => {
                if (readOnly && onReadOnlyPress) {
                  onReadOnlyPress(item);
                  return;
                }
                router.push({
                  pathname: '/entry-detail',
                  params: {
                    id: item.id,
                    name: item.name,
                    portion: item.portion_description ?? '',
                    cal: String(item.calories),
                    protein_g: String(item.protein_g),
                    carbs_g: String(item.carbs_g),
                    fat_g: String(item.fat_g),
                    fiber_g: String(item.fiber_g ?? 0),
                    sugar_g: String(item.sugar_g ?? 0),
                    sodium_mg: String(item.sodium_mg ?? 0),
                    saturated_fat_g: String(item.saturated_fat_g ?? 0),
                    cholesterol_mg: String(item.cholesterol_mg ?? 0),
                    logged_at: item.logged_at,
                    readOnly: readOnly ? '1' : '',
                  },
                });
              }}
              style={({ pressed }) => ({
                paddingHorizontal: 12,
                paddingVertical: 8,
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 8,
                opacity: pressed ? 0.6 : 1,
                backgroundColor: pressed ? t.surface2 : 'transparent',
              })}
            >
              <View
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 999,
                  backgroundColor: t.primarySoft,
                  marginTop: 5,
                }}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[typo.subhead, { color: t.text }]}>
                  {item.name}
                </Text>
                {!!item.portion_description && (
                  <Text
                    style={[
                      typo.caption1,
                      { color: t.textTer, marginTop: 2 },
                    ]}
                  >
                    {item.portion_description}
                  </Text>
                )}
              </View>
              <Text
                style={[
                  typo.footnote,
                  {
                    color: t.textSec,
                    fontVariant: ['tabular-nums'],
                  },
                ]}
              >
                {item.calories}
              </Text>
            </Pressable>
            {!isLast && (
              <View
                style={{
                  height: 0.5,
                  backgroundColor: t.separator,
                  marginLeft: 28,
                }}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}
