import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { radius, space, type as typo, useTheme, type Theme } from '../../lib/theme';
import Toast from '../../components/Toast';
import { useToast } from '../../lib/useToast';
import { useAuth } from '../../lib/AuthContext';
import {
  addFoodEntry,
  getCurrentMacroTarget,
  getPlannedMealsForWeek,
} from '../../lib/db';
import { supabase } from '../../lib/supabase';
import type { MacroTarget, PlannedMeal } from '../../lib/types';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

const DEFAULT_TARGETS = {
  cal: 2000,
  protein: 160,
  carbs: 220,
  fat: 65,
};

const mockTemplates = [
  { name: 'Gym day', cal: 2200 },
  { name: 'Rest day', cal: 1800 },
  { name: 'Work from home', cal: 1950 },
];

function startOfWeekMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay(); // 0 = Sunday
  const offset = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + offset);
  return d;
}

function todayIndexInWeek(date: Date): number {
  const dow = date.getDay();
  return dow === 0 ? 6 : dow - 1;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isPastDay(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d < today;
}

function formatPlannedTime(time: string | null): string {
  if (!time) return '';
  const [hStr, mStr] = time.split(':');
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr ?? '0', 10);
  if (!Number.isFinite(h)) return '';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 === 0 ? 12 : h % 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ── Subcomponents ────────────────────────────────────────────────────────────
function DayPill({
  label,
  dateNumber,
  isSelected,
  isToday,
  onPress,
}: {
  label: string;
  dateNumber: number;
  isSelected: boolean;
  isToday: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: radius.lg,
        backgroundColor: isSelected ? t.primary : t.surface2,
        alignItems: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text
        style={[
          typo.caption2,
          {
            color: isSelected ? t.textOnPrim : t.textTer,
            letterSpacing: 0.06,
            fontWeight: '700',
            textTransform: 'uppercase',
          },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          typo.subheadEm,
          {
            color: isSelected ? t.textOnPrim : t.text,
            marginTop: 2,
            fontVariant: ['tabular-nums'],
          },
        ]}
      >
        {dateNumber}
      </Text>
      {isToday && (
        <View
          style={{
            width: 4,
            height: 4,
            borderRadius: 2,
            backgroundColor: isSelected ? t.textOnPrim : t.primary,
            marginTop: 3,
          }}
        />
      )}
    </Pressable>
  );
}

function MiniMacro({
  label,
  cur,
  target,
  color,
  t,
}: {
  label: string;
  cur: number;
  target: number;
  color: string;
  t: Theme;
}) {
  const pct = Math.max(0, Math.min(1, target === 0 ? 0 : cur / target));
  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 4,
        }}
      >
        <Text style={[typo.subheadEm, { color: t.text }]}>{label}</Text>
        <Text style={[typo.caption1, { color: t.textSec }]}>
          <Text style={{ color: t.text, fontWeight: '700' }}>{cur}</Text>
          {` / ${target}g`}
        </Text>
      </View>
      <View
        style={{
          height: 4,
          backgroundColor: t.surface2,
          borderRadius: radius.pill,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            height: '100%',
            width: `${pct * 100}%`,
            backgroundColor: color,
            borderRadius: radius.pill,
          }}
        />
      </View>
    </View>
  );
}

function SectionLabel({ label }: { label: string }) {
  const t = useTheme();
  return (
    <Text
      style={[
        typo.caption2,
        {
          color: t.textTer,
          letterSpacing: 0.06,
          textTransform: 'uppercase',
          fontWeight: '700',
          paddingHorizontal: space.xl,
          marginTop: space.xl,
          marginBottom: space.sm,
        },
      ]}
    >
      {label}
    </Text>
  );
}

function LoggedBadge() {
  const t = useTheme();
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        marginTop: space.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: t.successSoft,
        borderRadius: radius.pill,
        paddingHorizontal: 10,
        paddingVertical: 4,
      }}
    >
      <Ionicons name="checkmark-outline" size={12} color={t.success} />
      <Text
        style={[
          typo.caption2,
          { color: t.success, fontWeight: '600' },
        ]}
      >
        Logged
      </Text>
    </View>
  );
}

function MealCard({
  meal,
  isPast,
  onLogNow,
}: {
  meal: PlannedMeal;
  isPast: boolean;
  onLogNow: () => void;
}) {
  const t = useTheme();
  const time = formatPlannedTime(meal.planned_time);
  return (
    <View
      style={{
        backgroundColor: t.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: t.hairline,
        paddingHorizontal: space.lg,
        paddingVertical: space.md,
        marginHorizontal: space.lg,
        marginBottom: space.sm,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flex: 1, paddingRight: space.sm }}>
          {!!time && (
            <Text style={[typo.caption1, { color: t.textTer }]}>{time}</Text>
          )}
          <Text
            style={[typo.subheadEm, { color: t.text, marginTop: 2 }]}
            numberOfLines={1}
          >
            {meal.name}
          </Text>
          {!!meal.portion_description && (
            <Text
              style={[typo.caption1, { color: t.textSec, marginTop: 2 }]}
              numberOfLines={1}
            >
              {meal.portion_description}
            </Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text
            style={[
              typo.subheadEm,
              { color: t.text, fontVariant: ['tabular-nums'] },
            ]}
          >
            {meal.calories}
          </Text>
          <Text
            style={[
              typo.caption2,
              { marginTop: 2, fontVariant: ['tabular-nums'] },
            ]}
          >
            <Text style={{ color: t.protein, fontWeight: '600' }}>
              {Math.round(Number(meal.protein_g))}p
            </Text>
            <Text style={{ color: t.textTer }}>{' · '}</Text>
            <Text style={{ color: t.carbs, fontWeight: '600' }}>
              {Math.round(Number(meal.carbs_g))}c
            </Text>
            <Text style={{ color: t.textTer }}>{' · '}</Text>
            <Text style={{ color: t.fat, fontWeight: '600' }}>
              {Math.round(Number(meal.fat_g))}f
            </Text>
          </Text>
        </View>
      </View>

      {meal.is_logged ? (
        <LoggedBadge />
      ) : (
        !isPast && (
          <Pressable
            onPress={onLogNow}
            style={({ pressed }) => ({
              alignSelf: 'flex-start',
              marginTop: space.md,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: radius.md,
              backgroundColor: t.primarySoft,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text
              style={[typo.footnote, { color: t.primary, fontWeight: '600' }]}
            >
              Log now
            </Text>
          </Pressable>
        )
      )}
    </View>
  );
}

function EmptyPlanned({ isPast }: { isPast: boolean }) {
  const t = useTheme();
  return (
    <View
      style={{
        alignItems: 'center',
        paddingVertical: space.xxxl,
        gap: space.sm,
      }}
    >
      <Ionicons name="calendar-outline" size={48} color={t.textTer} />
      <Text style={[typo.subhead, { color: t.textTer }]}>
        {isPast ? 'Nothing was planned' : 'Nothing planned'}
      </Text>
    </View>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────
export default function Meals() {
  const t = useTheme();
  const toast = useToast();
  const { user } = useAuth();

  const [plannedMeals, setPlannedMeals] = useState<PlannedMeal[]>([]);
  const [macroTarget, setMacroTarget] = useState<MacroTarget | null>(null);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const monday = startOfWeekMonday(today);
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
  const todayIdx = todayIndexInWeek(today);

  const [selectedDay, setSelectedDay] = useState<number>(todayIdx);
  const selectedDate = weekDates[selectedDay];
  const isPast = isPastDay(selectedDate);

  const loadMeals = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const weekStart = startOfWeekMonday(new Date());
      const [meals, target] = await Promise.all([
        getPlannedMealsForWeek(user.id, weekStart),
        getCurrentMacroTarget(user.id),
      ]);
      setPlannedMeals(meals);
      setMacroTarget(target);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void loadMeals();
    }, [loadMeals]),
  );

  const getMealsForDate = (date: Date): PlannedMeal[] => {
    const dateStr = date.toLocaleDateString('en-CA');
    return plannedMeals.filter((m) => m.planned_for === dateStr);
  };

  const hasAnyMeals = plannedMeals.length > 0;
  const selectedDateMeals = getMealsForDate(selectedDate);
  const selectedDateTotals = {
    cal: selectedDateMeals.reduce((s, m) => s + m.calories, 0),
    p: selectedDateMeals.reduce((s, m) => s + Number(m.protein_g), 0),
    c: selectedDateMeals.reduce((s, m) => s + Number(m.carbs_g), 0),
    f: selectedDateMeals.reduce((s, m) => s + Number(m.fat_g), 0),
  };

  const targetCal = macroTarget?.calories ?? DEFAULT_TARGETS.cal;
  const targetP = macroTarget?.protein_g ?? DEFAULT_TARGETS.protein;
  const targetC = macroTarget?.carbs_g ?? DEFAULT_TARGETS.carbs;
  const targetF = macroTarget?.fat_g ?? DEFAULT_TARGETS.fat;

  const handleLogNow = async (meal: PlannedMeal) => {
    if (!user) return;
    try {
      await addFoodEntry({
        user_id: user.id,
        logged_at: new Date().toISOString(),
        name: meal.name,
        portion_description: meal.portion_description ?? '',
        quantity: 1,
        unit: 'serving',
        calories: meal.calories,
        protein_g: meal.protein_g,
        carbs_g: meal.carbs_g,
        fat_g: meal.fat_g,
        fiber_g: 0,
        sugar_g: 0,
        sodium_mg: 0,
        saturated_fat_g: 0,
        cholesterol_mg: 0,
        food_database_id: null,
        barcode: null,
        source: 'manual',
      });
      await supabase
        .from('planned_meals')
        .update({ is_logged: true })
        .eq('id', meal.id);
      await loadMeals();
      toast.show(`${meal.name} logged`, 'success');
    } catch {
      toast.show('Could not log meal. Try again.', 'error');
    }
  };

  const [shoppingOpen, setShoppingOpen] = useState(false);
  const [shoppingChecked, setShoppingChecked] = useState<Set<string>>(
    new Set(),
  );

  const shoppingList = useMemo(() => {
    const map: Record<string, { amount: string; count: number }> = {};
    for (const meal of plannedMeals) {
      const key = meal.name.toLowerCase();
      const existing = map[key];
      if (existing) {
        existing.count += 1;
      } else {
        map[key] = {
          amount: meal.portion_description ?? '1 serving',
          count: 1,
        };
      }
    }
    return Object.entries(map).map(([name, v]) => ({
      name,
      amount: v.amount,
      mealCount: v.count,
    }));
  }, [plannedMeals]);

  const handleShoppingList = () => {
    setShoppingChecked(new Set());
    setShoppingOpen(true);
  };

  const handleShareShoppingList = () => {
    const lines = shoppingList.map(
      (item) => `• ${item.name} (${item.amount}) × ${item.mealCount}`,
    );
    const message = `Shopping list\n\n${lines.join('\n')}`;
    void Share.share({ message });
  };

  const toggleShoppingChecked = (name: string) => {
    setShoppingChecked((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const insets = useSafeAreaInsets();

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
        <View style={{ paddingHorizontal: space.xl, paddingTop: space.lg }}>
          <Text style={[typo.largeTitle, { color: t.text }]}>Meals</Text>
          <Text style={[typo.subhead, { color: t.textSec, marginTop: 2 }]}>
            Plan your week
          </Text>
        </View>

        {/* Week strip */}
        <View
          style={{
            flexDirection: 'row',
            gap: space.xs,
            paddingHorizontal: space.lg,
            marginTop: space.lg,
          }}
        >
          {weekDates.map((date, i) => (
            <DayPill
              key={i}
              label={DAY_NAMES[i]}
              dateNumber={date.getDate()}
              isSelected={i === selectedDay}
              isToday={isSameDay(date, today)}
              onPress={() => setSelectedDay(i)}
            />
          ))}
        </View>

        {/* Week-level empty state when nothing is planned anywhere */}
        {!loading && !hasAnyMeals && (
          <View
            style={{
              alignItems: 'center',
              paddingVertical: space.xxxl,
              paddingHorizontal: space.xl,
            }}
          >
            <Ionicons
              name="calendar-outline"
              size={48}
              color={t.textTer}
            />
            <Text
              style={[
                typo.subhead,
                { color: t.textTer, marginTop: space.md },
              ]}
            >
              Nothing planned this week
            </Text>
            <Text
              style={[
                typo.footnote,
                { color: t.textTer, marginTop: space.xs },
              ]}
            >
              Tap any day to start planning
            </Text>
          </View>
        )}

        {/* Selected day macro summary */}
        {!loading && hasAnyMeals && (
          <View
            style={{
              backgroundColor: t.surface,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: t.hairline,
              paddingHorizontal: space.lg,
              paddingVertical: space.md,
              marginHorizontal: space.lg,
              marginTop: space.md,
            }}
          >
            {selectedDateMeals.length === 0 ? (
              <Text
                style={[
                  typo.subhead,
                  { color: t.textTer, textAlign: 'center' },
                ]}
              >
                No meals planned
              </Text>
            ) : (
              <>
                <Text
                  style={[
                    typo.subheadEm,
                    {
                      color: t.text,
                      fontVariant: ['tabular-nums'],
                    },
                  ]}
                >
                  {`${selectedDateTotals.cal.toLocaleString()} / ${targetCal.toLocaleString()} kcal planned`}
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    gap: space.md,
                    marginTop: space.md,
                  }}
                >
                  <MiniMacro
                    label="Protein"
                    cur={Math.round(selectedDateTotals.p)}
                    target={targetP}
                    color={t.protein}
                    t={t}
                  />
                  <MiniMacro
                    label="Carbs"
                    cur={Math.round(selectedDateTotals.c)}
                    target={targetC}
                    color={t.carbs}
                    t={t}
                  />
                  <MiniMacro
                    label="Fat"
                    cur={Math.round(selectedDateTotals.f)}
                    target={targetF}
                    color={t.fat}
                    t={t}
                  />
                </View>
              </>
            )}
          </View>
        )}

        {/* Selected day date label + optional Past badge */}
        <View
          style={{
            paddingHorizontal: space.xl,
            marginTop: space.md,
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.sm,
          }}
        >
          <Text style={[typo.title3, { color: t.text }]}>
            {selectedDate.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
            {isSameDay(selectedDate, today) && (
              <Text style={[typo.title3, { color: t.textSec }]}>
                {' · Today'}
              </Text>
            )}
          </Text>
          {isPast && (
            <View
              style={{
                backgroundColor: t.surface2,
                borderRadius: radius.sm,
                paddingHorizontal: space.sm,
                paddingVertical: 2,
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
                Past
              </Text>
            </View>
          )}
        </View>

        {/* Planned meals */}
        <SectionLabel label="Planned meals" />
        {loading ? (
          <View
            style={{
              alignItems: 'center',
              paddingVertical: space.xxxl,
            }}
          >
            <ActivityIndicator color={t.primary} />
          </View>
        ) : selectedDateMeals.length === 0 ? (
          <EmptyPlanned isPast={isPast} />
        ) : (
          selectedDateMeals.map((meal) => (
            <MealCard
              key={meal.id}
              meal={meal}
              isPast={isPast}
              onLogNow={() => void handleLogNow(meal)}
            />
          ))
        )}

        {/* Add to plan — dashed primary button. Hidden for past days. */}
        {!isPast && (
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/add-to-plan',
                params: {
                  date: weekDates[selectedDay].toLocaleDateString('en-CA'),
                },
              })
            }
            style={({ pressed }) => ({
              marginHorizontal: space.lg,
              marginTop: space.md,
              borderRadius: radius.lg,
              borderWidth: 1.5,
              borderColor: `${t.primary}66`,
              borderStyle: 'dashed',
              paddingVertical: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: space.sm,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Ionicons
              name="add-circle-outline"
              size={20}
              color={t.primary}
            />
            <Text style={[typo.subhead, { color: t.primary }]}>
              Add to plan
            </Text>
          </Pressable>
        )}

        {/* Day templates */}
        <SectionLabel label="Day templates" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: space.lg,
            gap: space.sm,
          }}
        >
          {mockTemplates.map((tpl) => (
            <Pressable
              key={tpl.name}
              style={({ pressed }) => ({
                backgroundColor: t.surface,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: t.hairline,
                paddingHorizontal: space.md,
                paddingVertical: space.sm,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text style={[typo.subheadEm, { color: t.text }]}>
                {tpl.name}
              </Text>
              <Text
                style={[typo.caption1, { color: t.textSec, marginTop: 2 }]}
              >
                {`${tpl.cal.toLocaleString()} kcal`}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Generate shopping list */}
        <Pressable
          onPress={handleShoppingList}
          style={({ pressed }) => ({
            height: 52,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: t.hairline,
            backgroundColor: t.surface,
            marginHorizontal: space.lg,
            marginTop: space.xl,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: space.sm,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Ionicons name="cart-outline" size={20} color={t.text} />
          <Text style={[typo.subheadEm, { color: t.text }]}>
            Generate shopping list
          </Text>
        </Pressable>
      </ScrollView>

      <Toast
        message={toast.message}
        visible={toast.visible}
        type={toast.type}
        duration={toast.duration}
        onHide={toast.hide}
      />

      <Modal
        visible={shoppingOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setShoppingOpen(false)}
      >
        <Pressable
          onPress={() => setShoppingOpen(false)}
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
              paddingHorizontal: space.xl,
              paddingTop: space.lg,
              paddingBottom: insets.bottom + space.xl,
              maxHeight: '85%',
            }}
          >
            <View style={{ alignItems: 'center' }}>
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
                typo.title3,
                { color: t.text, marginTop: space.lg },
              ]}
            >
              Shopping list
            </Text>
            <Text style={[typo.subhead, { color: t.textSec, marginTop: 2 }]}>
              Based on your meals this week
            </Text>

            <ScrollView
              style={{ marginTop: space.lg, maxHeight: 360 }}
              showsVerticalScrollIndicator={false}
            >
              {shoppingList.length === 0 ? (
                <Text
                  style={[
                    typo.footnote,
                    {
                      color: t.textTer,
                      paddingVertical: space.lg,
                      textAlign: 'center',
                    },
                  ]}
                >
                  No meals planned this week.
                </Text>
              ) : (
                shoppingList.map((item, i) => {
                  const checked = shoppingChecked.has(item.name);
                  const isLast = i === shoppingList.length - 1;
                  return (
                    <View key={item.name}>
                      <Pressable
                        onPress={() => toggleShoppingChecked(item.name)}
                        style={({ pressed }) => ({
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 12,
                          paddingVertical: 12,
                          opacity: pressed ? 0.6 : 1,
                        })}
                      >
                        <View
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 11,
                            backgroundColor: checked ? t.primary : t.surface2,
                            borderWidth: checked ? 0 : 1,
                            borderColor: t.hairline,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {checked && (
                            <Ionicons
                              name="checkmark"
                              size={14}
                              color={t.textOnPrim}
                            />
                          )}
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text
                            style={[
                              typo.subhead,
                              {
                                color: checked ? t.textTer : t.text,
                                textDecorationLine: checked
                                  ? 'line-through'
                                  : 'none',
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {item.name}
                          </Text>
                          <Text
                            style={[
                              typo.caption1,
                              { color: t.textSec, marginTop: 2 },
                            ]}
                            numberOfLines={1}
                          >
                            {`${item.amount} · ${item.mealCount} meal${item.mealCount === 1 ? '' : 's'}`}
                          </Text>
                        </View>
                      </Pressable>
                      {!isLast && (
                        <View
                          style={{
                            height: 0.5,
                            backgroundColor: t.hairline,
                            marginLeft: 22 + 12,
                          }}
                        />
                      )}
                    </View>
                  );
                })
              )}
            </ScrollView>

            <Pressable
              onPress={handleShareShoppingList}
              disabled={shoppingList.length === 0}
              style={({ pressed }) => ({
                marginTop: space.lg,
                height: 48,
                borderRadius: radius.lg,
                backgroundColor: t.surface2,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: space.sm,
                opacity:
                  shoppingList.length === 0 ? 0.4 : pressed ? 0.6 : 1,
              })}
            >
              <Ionicons name="share-outline" size={18} color={t.text} />
              <Text style={[typo.subhead, { color: t.text }]}>
                Share list
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setShoppingOpen(false)}
              style={({ pressed }) => ({
                marginTop: space.md,
                height: 52,
                borderRadius: radius.lg,
                backgroundColor: t.primary,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={[typo.headline, { color: t.textOnPrim }]}>
                Done
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
