import { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { radius, space, type as typo, useTheme, type Theme } from '../lib/theme';
import { formatDisplayTime, parseLoggedAt } from '../lib/groupEntries';
import { deleteFoodEntry } from '../lib/db';
import { sessionState } from '../lib/sessionState';

const UNITS = ['g', 'oz', 'cup', 'tbsp', 'tsp', 'serving', 'piece'] as const;
type Unit = (typeof UNITS)[number];

const HUNGER_LABELS = [
  'Not hungry',
  'Slightly hungry',
  'Moderate',
  'Hungry',
  'Very hungry',
];

type MacroTileProps = {
  label: string;
  value: string;
  unit?: string;
  bg: string;
  textColor: string;
  labelColor: string;
};

function MacroTile({
  label,
  value,
  unit,
  bg,
  textColor,
  labelColor,
}: MacroTileProps) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: bg,
        borderRadius: radius.lg,
        padding: space.md,
      }}
    >
      <Text
        style={[
          typo.caption2,
          {
            color: labelColor,
            letterSpacing: 0.06,
            textTransform: 'uppercase',
            fontWeight: '700',
          },
        ]}
      >
        {label}
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
            typo.title2,
            { color: textColor, fontVariant: ['tabular-nums'] },
          ]}
        >
          {value}
        </Text>
        {unit && (
          <Text
            style={[typo.subhead, { color: textColor, marginLeft: 2 }]}
          >
            {unit}
          </Text>
        )}
      </View>
    </View>
  );
}

function NutritionRow({
  label,
  value,
  isLast,
  t,
}: {
  label: string;
  value: string;
  isLast: boolean;
  t: Theme;
}) {
  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: space.md,
          paddingVertical: 12,
        }}
      >
        <Text style={[typo.subhead, { color: t.textSec }]}>{label}</Text>
        <Text style={[typo.subhead, { color: t.text }]}>{value}</Text>
      </View>
      {!isLast && (
        <View style={{ height: 0.5, backgroundColor: t.hairline }} />
      )}
    </View>
  );
}

// TODO: replace with real data from Supabase
const NUTRITION_DETAILS = [
  { label: 'Fiber', value: '4g' },
  { label: 'Sugar', value: '12g' },
  { label: 'Sodium', value: '140mg' },
  { label: 'Saturated fat', value: '1g' },
  { label: 'Cholesterol', value: '0mg' },
];

export default function EntryDetail() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id?: string;
    name?: string;
    portion?: string;
    cal?: string;
    protein_g?: string;
    carbs_g?: string;
    fat_g?: string;
    logged_at?: string;
  }>();

  const id = params.id;
  const name = params.name ?? '';
  const cal = Number(params.cal ?? '0');
  const protein = Number(params.protein_g ?? '0');
  const carbs = Number(params.carbs_g ?? '0');
  const fat = Number(params.fat_g ?? '0');
  const loggedAt = params.logged_at
    ? formatDisplayTime(parseLoggedAt(params.logged_at))
    : '';

  const [quantityText, setQuantityText] = useState('1');
  const [unitIndex, setUnitIndex] = useState(0);
  const unit: Unit = UNITS[unitIndex];
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);
  const [nutritionOpen, setNutritionOpen] = useState(false);
  const [hunger, setHunger] = useState<number | null>(null);

  const handleDelete = () => {
    if (!id) return;
    Alert.alert('Delete entry?', 'This will remove it from your log.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteFoodEntry(id);
            sessionState.setJustLoggedFood(null);
            router.back();
          } catch {
            Alert.alert('Error', 'Could not delete entry. Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: t.bg }}
      edges={['top', 'left', 'right']}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: space.xxxl }}
        keyboardShouldPersistTaps="handled"
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
          <View style={{ paddingHorizontal: space.xl, marginTop: 12 }}>
            <Text style={[typo.title3, { color: t.text }]}>{name}</Text>
            {!!loggedAt && (
              <Text
                style={[
                  typo.footnote,
                  { color: t.textSec, marginTop: 2 },
                ]}
              >
                {`Logged at ${loggedAt}`}
              </Text>
            )}
          </View>
          <Pressable
            onPress={() => router.back()}
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
            hitSlop={6}
          >
            <Ionicons name="close-outline" size={18} color={t.textSec} />
          </Pressable>
        </View>

        {/* 2x2 macro grid */}
        <View style={{ paddingHorizontal: space.xl, marginTop: space.lg }}>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <MacroTile
              label="calories"
              value={String(cal)}
              bg={t.surface2}
              textColor={t.text}
              labelColor={t.textTer}
            />
            <MacroTile
              label="protein"
              value={String(protein)}
              unit="g"
              bg={t.primarySoft}
              textColor={t.protein}
              labelColor={t.protein}
            />
          </View>
          <View
            style={{
              flexDirection: 'row',
              gap: space.sm,
              marginTop: space.sm,
            }}
          >
            <MacroTile
              label="carbs"
              value={String(carbs)}
              unit="g"
              bg={t.warnSoft}
              textColor={t.carbs}
              labelColor={t.carbs}
            />
            <MacroTile
              label="fat"
              value={String(fat)}
              unit="g"
              bg={t.tealSoft}
              textColor={t.teal}
              labelColor={t.teal}
            />
          </View>
        </View>

        {/* Portion editor */}
        <View
          style={{
            paddingHorizontal: space.xl,
            marginTop: space.xl,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text style={[typo.subhead, { color: t.text }]}>Serving size</Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.sm,
            }}
          >
            <TextInput
              value={quantityText}
              onChangeText={setQuantityText}
              keyboardType="decimal-pad"
              returnKeyType="done"
              style={[
                typo.headline,
                {
                  width: 56,
                  height: 36,
                  borderRadius: radius.sm,
                  backgroundColor: t.surface2,
                  color: t.text,
                  textAlign: 'center',
                  padding: 0,
                },
              ]}
            />
            <Pressable
              onPress={() => setUnitPickerOpen(true)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.xs,
                backgroundColor: t.surface2,
                borderRadius: radius.sm,
                paddingHorizontal: 12,
                paddingVertical: 8,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text style={[typo.subhead, { color: t.text }]}>{unit}</Text>
              <Ionicons
                name="chevron-down"
                size={14}
                color={t.textSec}
              />
            </Pressable>
          </View>
        </View>

        {/* Nutrition details — expandable */}
        <View style={{ paddingHorizontal: space.xl, marginTop: space.xl }}>
          <View
            style={{
              backgroundColor: t.surface,
              borderRadius: radius.lg,
              borderWidth: 0.5,
              borderColor: t.hairline,
              overflow: 'hidden',
            }}
          >
            <Pressable
              onPress={() => setNutritionOpen((v) => !v)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: space.md,
                paddingVertical: 14,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text style={[typo.subheadEm, { color: t.text }]}>
                Nutrition details
              </Text>
              <Ionicons
                name={nutritionOpen ? 'chevron-down' : 'chevron-forward'}
                size={18}
                color={t.textSec}
              />
            </Pressable>
            {nutritionOpen && (
              <View>
                <View style={{ height: 0.5, backgroundColor: t.hairline }} />
                {NUTRITION_DETAILS.map((row, i) => (
                  <NutritionRow
                    key={row.label}
                    label={row.label}
                    value={row.value}
                    isLast={i === NUTRITION_DETAILS.length - 1}
                    t={t}
                  />
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Hunger rating */}
        <View style={{ paddingHorizontal: space.xl, marginTop: space.xl }}>
          <Text style={[typo.subhead, { color: t.textSec }]}>
            How hungry were you?
          </Text>
          <View
            style={{
              flexDirection: 'row',
              gap: space.sm,
              marginTop: space.sm,
            }}
          >
            {[1, 2, 3, 4, 5].map((level) => {
              const filled = hunger !== null && level <= hunger;
              return (
                <Pressable
                  key={level}
                  onPress={() => setHunger(level)}
                  hitSlop={6}
                  style={({ pressed }) => ({
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: filled ? t.primary : t.surface3,
                    opacity: pressed ? 0.6 : 1,
                  })}
                />
              );
            })}
          </View>
          <Text
            style={[
              typo.caption1,
              { color: t.textTer, marginTop: space.xs },
            ]}
          >
            {hunger === null
              ? 'Tap to rate'
              : HUNGER_LABELS[hunger - 1]}
          </Text>
        </View>

        {/* Delete entry */}
        <View style={{ paddingHorizontal: space.xl, marginTop: space.xl }}>
          <Pressable
            onPress={handleDelete}
            style={({ pressed }) => ({
              height: 48,
              borderRadius: radius.lg,
              backgroundColor: t.dangerSoft,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: space.sm,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Ionicons name="trash-outline" size={18} color={t.danger} />
            <Text style={[typo.subheadEm, { color: t.danger }]}>
              Delete entry
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Unit picker */}
      <Modal
        visible={unitPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setUnitPickerOpen(false)}
      >
        <Pressable
          onPress={() => setUnitPickerOpen(false)}
          style={{
            flex: 1,
            backgroundColor: t.scrim,
            justifyContent: 'flex-end',
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: t.surface,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              paddingTop: space.sm,
              paddingBottom: insets.bottom + space.sm,
            }}
          >
            <View style={{ alignItems: 'center', paddingVertical: space.sm }}>
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
                typo.caption2,
                {
                  color: t.textTer,
                  letterSpacing: 0.06,
                  textTransform: 'uppercase',
                  fontWeight: '700',
                  paddingHorizontal: space.xl,
                  paddingBottom: space.sm,
                },
              ]}
            >
              Unit
            </Text>
            {UNITS.map((u, i) => {
              const selected = i === unitIndex;
              const isLast = i === UNITS.length - 1;
              return (
                <View key={u}>
                  <Pressable
                    onPress={() => {
                      setUnitIndex(i);
                      setUnitPickerOpen(false);
                    }}
                    style={({ pressed }) => ({
                      paddingHorizontal: space.xl,
                      paddingVertical: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      opacity: pressed ? 0.6 : 1,
                    })}
                  >
                    <Text
                      style={[
                        typo.body,
                        {
                          color: selected ? t.primary : t.text,
                          fontWeight: selected ? '600' : '400',
                        },
                      ]}
                    >
                      {u}
                    </Text>
                    {selected && (
                      <Ionicons
                        name="checkmark"
                        size={20}
                        color={t.primary}
                      />
                    )}
                  </Pressable>
                  {!isLast && (
                    <View
                      style={{
                        height: 0.5,
                        backgroundColor: t.hairline,
                        marginLeft: space.xl,
                      }}
                    />
                  )}
                </View>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
