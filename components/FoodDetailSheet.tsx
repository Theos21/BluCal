import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import {
  radius,
  space,
  type as typo,
  useTheme,
  type Theme,
} from '../lib/theme';
import type { FoodSearchResult } from '../lib/foodSearch';
import type { CustomFood } from '../lib/types';

type Macros = { cal: number; protein: number; carbs: number; fat: number };

interface FoodDetailSheetProps {
  food: FoodSearchResult | CustomFood | null;
  onDismiss: () => void;
  onLog: () => void;
  currentMacros: Macros;
  targets: Macros;
}

// Title-cases food names so all-caps database entries render cleanly.
const formatFoodName = (name: string): string => {
  if (!name) return '';
  if (name === name.toUpperCase()) {
    return name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return name.replace(/\b\w/g, (c) => c.toUpperCase());
};

const num = (v: number | null | undefined): number => Number(v) || 0;

// A single macro ring. The solid arc is the amount already consumed today;
// a semi-transparent extension previews what logging this food would add.
function PreviewRing({
  label,
  current,
  target,
  adding,
  color,
  t,
  size = 72,
}: {
  label: string;
  current: number;
  target: number;
  adding: number;
  color: string;
  t: Theme;
  size?: number;
}) {
  const strokeWidth = 7;
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const currentProgress = Math.min(1, target > 0 ? current / target : 0);
  const totalProgress = Math.min(
    1,
    target > 0 ? (current + adding) / target : 0,
  );
  const currentOffset = circ * (1 - currentProgress);
  const totalOffset = circ * (1 - totalProgress);
  const isOver = current + adding > target;

  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <View style={{ width: size, height: size, position: 'relative' }}>
        <Svg
          width={size}
          height={size}
          style={{ transform: [{ rotate: '-90deg' }] }}
        >
          {/* Background track */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={t.surface2}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Preview arc — what logging this food would add */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={isOver ? t.danger : color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circ}
            strokeDashoffset={totalOffset}
            opacity={0.35}
          />
          {/* Solid current-progress arc */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={isOver ? t.danger : color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circ}
            strokeDashoffset={currentOffset}
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
              fontSize: 13,
              fontWeight: '700',
              color: isOver ? t.danger : t.text,
            }}
          >
            {`+${Math.round(adding)}`}
          </Text>
        </View>
      </View>
      <Text style={[typo.caption2, { color: t.textSec }]}>{label}</Text>
    </View>
  );
}

function NutritionRow({
  label,
  value,
  indented,
  t,
}: {
  label: string;
  value: string;
  indented?: boolean;
  t: Theme;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 9,
        paddingLeft: indented ? space.lg : 0,
      }}
    >
      <Text
        style={[
          typo.subhead,
          {
            color: indented ? t.textSec : t.text,
            fontWeight: indented ? '400' : '600',
          },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          typo.subhead,
          { color: t.textSec, fontVariant: ['tabular-nums'] },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

export default function FoodDetailSheet({
  food,
  onDismiss,
  onLog,
  currentMacros,
  targets,
}: FoodDetailSheetProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();

  // Retain the last food while the sheet animates out so its content does
  // not blank before the slide-down finishes.
  const [shownFood, setShownFood] = useState(food);
  useEffect(() => {
    if (food) setShownFood(food);
  }, [food]);

  if (!shownFood) return null;

  // FoodSearchResult and CustomFood overlap on the nutrition fields but are
  // not a single type; read them through a permissive shape.
  const f = shownFood as unknown as {
    name: string;
    brand?: string | null;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g?: number | null;
    sugar_g?: number | null;
    sodium_mg?: number | null;
    saturated_fat_g?: number | null;
    cholesterol_mg?: number | null;
    serving_size?: number | null;
    serving_unit?: string | null;
    serving_description?: string | null;
  };

  const cal = num(f.calories);
  const protein = num(f.protein_g);
  const carbs = num(f.carbs_g);
  const fat = num(f.fat_g);
  const fiber = num(f.fiber_g);
  const sugar = num(f.sugar_g);
  const sodium = num(f.sodium_mg);
  const satFat = num(f.saturated_fat_g);
  const cholesterol = num(f.cholesterol_mg);

  const name = formatFoodName(f.name);
  const brand = f.brand ? String(f.brand) : null;

  const servingText =
    f.serving_description ??
    (f.serving_size != null
      ? `${f.serving_size}${f.serving_unit ?? 'g'}`
      : null);

  return (
    <Modal
      visible={food !== null}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <Pressable
        onPress={onDismiss}
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
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            height: Math.round(screenH * 0.8),
          }}
        >
          {/* Drag handle */}
          <View style={{ alignItems: 'center', paddingTop: space.sm }}>
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: radius.pill,
                backgroundColor: t.surface3,
              }}
            />
          </View>

          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: space.xl,
              paddingTop: space.lg,
              paddingBottom: space.lg,
            }}
          >
            {/* Name + brand */}
            <Text style={[typo.title3, { color: t.text }]}>{name}</Text>
            {brand && (
              <Text
                style={[typo.subhead, { color: t.textSec, marginTop: 2 }]}
              >
                {brand}
              </Text>
            )}

            {/* Preview rings */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-around',
                marginTop: space.xl,
              }}
            >
              <PreviewRing
                label="Calories"
                current={currentMacros.cal}
                target={targets.cal}
                adding={cal}
                color={t.primary}
                t={t}
              />
              <PreviewRing
                label="Protein"
                current={currentMacros.protein}
                target={targets.protein}
                adding={protein}
                color={t.protein}
                t={t}
              />
              <PreviewRing
                label="Carbs"
                current={currentMacros.carbs}
                target={targets.carbs}
                adding={carbs}
                color={t.carbs}
                t={t}
              />
              <PreviewRing
                label="Fat"
                current={currentMacros.fat}
                target={targets.fat}
                adding={fat}
                color={t.fat}
                t={t}
              />
            </View>

            {/* Full nutrition table */}
            <View
              style={{
                marginTop: space.xl,
                borderTopWidth: 0.5,
                borderTopColor: t.hairline,
              }}
            >
              <NutritionRow
                label="Calories"
                value={`${Math.round(cal)} kcal`}
                t={t}
              />
              <NutritionRow
                label="Protein"
                value={`${Math.round(protein)}g`}
                t={t}
              />
              <NutritionRow
                label="Carbohydrates"
                value={`${Math.round(carbs)}g`}
                t={t}
              />
              <NutritionRow
                label="Sugar"
                value={`${Math.round(sugar)}g`}
                indented
                t={t}
              />
              <NutritionRow
                label="Fiber"
                value={`${Math.round(fiber)}g`}
                indented
                t={t}
              />
              <NutritionRow label="Fat" value={`${Math.round(fat)}g`} t={t} />
              <NutritionRow
                label="Saturated"
                value={`${Math.round(satFat)}g`}
                indented
                t={t}
              />
              <NutritionRow
                label="Sodium"
                value={`${Math.round(sodium)}mg`}
                t={t}
              />
              <NutritionRow
                label="Cholesterol"
                value={`${Math.round(cholesterol)}mg`}
                t={t}
              />
            </View>

            {/* Serving size */}
            {servingText && (
              <Text
                style={[
                  typo.caption1,
                  { color: t.textTer, marginTop: space.md },
                ]}
              >
                {`Per serving (${servingText})`}
              </Text>
            )}
          </ScrollView>

          {/* Footer: Cancel link above a large primary action */}
          <View
            style={{
              paddingHorizontal: space.xl,
              paddingTop: space.sm,
              paddingBottom: insets.bottom + space.md,
              borderTopWidth: 0.5,
              borderTopColor: t.hairline,
            }}
          >
            <Pressable
              onPress={onDismiss}
              hitSlop={6}
              style={({ pressed }) => ({
                alignSelf: 'center',
                paddingVertical: space.sm,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text style={[typo.subhead, { color: t.textSec }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onLog}
              style={({ pressed }) => ({
                height: 52,
                borderRadius: radius.lg,
                backgroundColor: t.primary,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: space.xs,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={[typo.headline, { color: t.textOnPrim }]}>
                Add to log
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
