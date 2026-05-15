import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import {
  radius,
  space,
  type as typo,
  useTheme,
  type Theme,
} from '../lib/theme';
import Toast from '../components/Toast';
import { useToast } from '../lib/useToast';
import { useAuth } from '../lib/AuthContext';
import {
  addPlannedMeal,
  getRecipesWithMacros,
  type RecipeWithMacros,
} from '../lib/db';
import {
  autocompleteFoods,
  searchFoods,
  type FoodSearchResult,
} from '../lib/foodSearch';

// "HH:MM" in 24h for DB storage; display via formatTime.
const PRESET_TIMES = [
  '07:00',
  '08:00',
  '09:00',
  '12:00',
  '13:00',
  '18:00',
  '19:00',
  '20:00',
] as const;

const DEFAULT_TIME_INDEX = 1; // 08:00

function formatTime(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(':');
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr ?? '0', 10);
  if (!Number.isFinite(h)) return '';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 === 0 ? 12 : h % 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatLongDate(yyyyMmDd: string): string {
  // Parse as local date to avoid an off-by-one when the YYYY-MM-DD string is
  // interpreted as UTC midnight.
  const [y, m, d] = yyyyMmDd.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return '';
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function MacroInputRow({
  label,
  value,
  onChangeText,
  color,
  unit,
  t,
}: {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  color: string;
  unit: string;
  t: Theme;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'stretch',
        paddingHorizontal: space.lg,
        paddingVertical: 12,
        gap: space.md,
      }}
    >
      <View
        style={{
          width: 3,
          borderRadius: radius.pill,
          backgroundColor: color,
        }}
      />
      <Text
        style={[
          typo.subheadEm,
          { color: t.text, flex: 1, alignSelf: 'center' },
        ]}
      >
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        returnKeyType="done"
        placeholder="0"
        placeholderTextColor={t.textTer}
        style={{
          width: 72,
          backgroundColor: t.surface2,
          borderRadius: radius.sm,
          paddingHorizontal: 8,
          paddingVertical: 8,
          ...typo.subhead,
          color: t.text,
          textAlign: 'center',
        }}
      />
      <Text
        style={[typo.subhead, { color: t.textSec, alignSelf: 'center', width: 28 }]}
      >
        {unit}
      </Text>
    </View>
  );
}

export default function AddToPlan() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    date?: string;
    prefillName?: string;
    prefillCal?: string;
    prefillProtein?: string;
    prefillCarbs?: string;
    prefillFat?: string;
    prefillPortion?: string;
  }>();
  const date = typeof params.date === 'string' ? params.date : '';
  const prefillName = typeof params.prefillName === 'string' ? params.prefillName : '';
  const prefillCal = typeof params.prefillCal === 'string' ? params.prefillCal : '';
  const prefillProtein =
    typeof params.prefillProtein === 'string' ? params.prefillProtein : '';
  const prefillCarbs =
    typeof params.prefillCarbs === 'string' ? params.prefillCarbs : '';
  const prefillFat = typeof params.prefillFat === 'string' ? params.prefillFat : '';
  const prefillPortion =
    typeof params.prefillPortion === 'string' ? params.prefillPortion : '';

  const [mealName, setMealName] = useState(prefillName);
  const [timeIdx, setTimeIdx] = useState<number>(DEFAULT_TIME_INDEX);
  const [portion, setPortion] = useState(prefillPortion);
  const [cal, setCal] = useState(prefillCal);
  const [protein, setProtein] = useState(prefillProtein);
  const [carbs, setCarbs] = useState(prefillCarbs);
  const [fat, setFat] = useState(prefillFat);
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeWithMacros | null>(
    null,
  );
  const [recipes, setRecipes] = useState<RecipeWithMacros[]>([]);
  const [recipesLoading, setRecipesLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodSearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, []);

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!text.trim()) {
      setSearchResults([]);
      setSuggestions([]);
      setSearching(false);
      return;
    }
    if (text.trim().length > 1) {
      autocompleteFoods(text)
        .then(setSuggestions)
        .catch(() => setSuggestions([]));
    } else {
      setSuggestions([]);
    }
    searchTimeout.current = setTimeout(async () => {
      try {
        setSearching(true);
        const results = await searchFoods(text);
        setSearchResults(results);
      } catch (e) {
        console.error(e);
      } finally {
        setSearching(false);
      }
    }, 500);
  };

  const handleSelectFood = (food: FoodSearchResult) => {
    setMealName(food.name);
    setCal(String(food.calories));
    setProtein(String(Math.round(food.protein_g)));
    setCarbs(String(Math.round(food.carbs_g)));
    setFat(String(Math.round(food.fat_g)));
    setPortion(food.serving_description || `${food.serving_size}${food.serving_unit}`);
    setSelectedRecipe(null);
    setSearchResults([]);
    setSuggestions([]);
    setSearchQuery('');
  };

  const handleOpenBarcode = () => {
    router.push({
      pathname: '/barcode-scanner',
      params: { returnTo: 'add-to-plan', date },
    });
  };

  const handleOpenBluAI = () => {
    router.push('/bluai');
  };

  useEffect(() => {
    if (!user) {
      setRecipesLoading(false);
      return;
    }
    getRecipesWithMacros(user.id)
      .then((rs) => setRecipes(rs))
      .catch(console.error)
      .finally(() => setRecipesLoading(false));
  }, [user]);

  const pickRecipe = (r: RecipeWithMacros) => {
    setSelectedRecipe(r);
    setMealName(r.name);
    setCal(String(r.perServing.calories));
    setProtein(String(r.perServing.protein_g));
    setCarbs(String(r.perServing.carbs_g));
    setFat(String(r.perServing.fat_g));
  };

  const canSave =
    mealName.trim().length > 0 &&
    !!date &&
    !!user &&
    !saving;

  const handleSave = async () => {
    if (!canSave || !user) return;
    setSaving(true);
    try {
      await addPlannedMeal({
        user_id: user.id,
        planned_for: date,
        planned_time: PRESET_TIMES[timeIdx],
        name: mealName.trim(),
        portion_description: portion.trim() || null,
        calories: Number(cal) || 0,
        protein_g: Number(protein) || 0,
        carbs_g: Number(carbs) || 0,
        fat_g: Number(fat) || 0,
        recipe_id: selectedRecipe?.id ?? null,
        is_logged: false,
      });
      router.back();
    } catch {
      setSaving(false);
      toast.show('Could not add to plan. Try again.', 'error');
    }
  };

  const longDate = date ? formatLongDate(date) : '';

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
            Add to plan
          </Text>
          {!!longDate && (
            <Text
              style={[
                typo.subhead,
                {
                  color: t.textSec,
                  textAlign: 'center',
                  marginTop: 2,
                },
              ]}
            >
              {longDate}
            </Text>
          )}
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
          contentContainerStyle={{ paddingBottom: space.xl }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Food search */}
          <View
            style={{
              marginHorizontal: space.lg,
              marginTop: space.xl,
              backgroundColor: t.surface2,
              borderRadius: radius.lg,
              paddingHorizontal: 14,
              paddingVertical: 10,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Ionicons name="search-outline" size={18} color={t.textTer} />
            <TextInput
              value={searchQuery}
              onChangeText={handleSearch}
              placeholder="Search food database"
              placeholderTextColor={t.textTer}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              style={[typo.body, { flex: 1, color: t.text, padding: 0 }]}
            />
            {searching && <ActivityIndicator color={t.primary} size="small" />}
          </View>

          {/* Barcode + BluAI quick actions */}
          <View
            style={{
              flexDirection: 'row',
              gap: space.sm,
              marginHorizontal: space.lg,
              marginTop: space.sm,
            }}
          >
            <Pressable
              onPress={handleOpenBarcode}
              style={({ pressed }) => ({
                flex: 1,
                height: 44,
                borderRadius: radius.lg,
                backgroundColor: t.surface2,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Ionicons name="barcode-outline" size={18} color={t.text} />
              <Text style={[typo.subhead, { color: t.text }]}>Scan barcode</Text>
            </Pressable>
            <Pressable
              onPress={handleOpenBluAI}
              style={({ pressed }) => ({
                flex: 1,
                height: 44,
                borderRadius: radius.lg,
                backgroundColor: t.surface2,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Ionicons name="sparkles-outline" size={18} color={t.primary} />
              <Text style={[typo.subhead, { color: t.text }]}>BluAI</Text>
            </Pressable>
          </View>

          {/* Autocomplete suggestion chips */}
          {suggestions.length > 0 && searchResults.length === 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: space.lg,
                paddingVertical: space.xs,
                gap: space.sm,
              }}
            >
              {suggestions.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => {
                    setSearchQuery(s);
                    handleSearch(s);
                    setSuggestions([]);
                  }}
                  style={({ pressed }) => ({
                    backgroundColor: t.surface2,
                    borderRadius: radius.pill,
                    paddingHorizontal: space.md,
                    paddingVertical: space.xs,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Text style={[typo.caption1, { color: t.textSec }]}>{s}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {searchResults.length > 0 && (
            <View
              style={{
                marginHorizontal: space.lg,
                marginTop: space.sm,
                backgroundColor: t.surface,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: t.hairline,
                overflow: 'hidden',
              }}
            >
              {searchResults.slice(0, 8).map((r, i) => {
                const isLast = i === Math.min(searchResults.length, 8) - 1;
                return (
                  <View key={r.id}>
                    <Pressable
                      onPress={() => handleSelectFood(r)}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: space.lg,
                        paddingVertical: 12,
                        gap: 12,
                        backgroundColor: pressed ? t.surface2 : 'transparent',
                      })}
                    >
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 12,
                          backgroundColor: t.primarySoft,
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Ionicons
                          name="nutrition-outline"
                          size={20}
                          color={t.primary}
                        />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          style={[
                            typo.subhead,
                            { color: t.text, fontWeight: '600' },
                          ]}
                          numberOfLines={1}
                        >
                          {r.name}
                        </Text>
                        {r.brand && (
                          <Text
                            style={[
                              typo.caption1,
                              { color: t.textSec, marginTop: 2 },
                            ]}
                            numberOfLines={1}
                          >
                            {r.brand}
                          </Text>
                        )}
                        <View
                          style={{
                            flexDirection: 'row',
                            gap: 6,
                            marginTop: 4,
                          }}
                        >
                          <View
                            style={{
                              backgroundColor: t.surface2,
                              borderRadius: 6,
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                            }}
                          >
                            <Text
                              style={[
                                typo.caption2,
                                { color: t.textSec, fontWeight: '600' },
                              ]}
                            >
                              {r.calories} cal
                            </Text>
                          </View>
                          <View
                            style={{
                              backgroundColor: t.primarySoft,
                              borderRadius: 6,
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                            }}
                          >
                            <Text
                              style={[
                                typo.caption2,
                                { color: t.primary, fontWeight: '600' },
                              ]}
                            >
                              {Math.round(Number(r.protein_g))}g P
                            </Text>
                          </View>
                          <View
                            style={{
                              backgroundColor: t.warnSoft,
                              borderRadius: 6,
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                            }}
                          >
                            <Text
                              style={[
                                typo.caption2,
                                { color: t.warn, fontWeight: '600' },
                              ]}
                            >
                              {Math.round(Number(r.carbs_g))}g C
                            </Text>
                          </View>
                          <View
                            style={{
                              backgroundColor: t.tealSoft,
                              borderRadius: 6,
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                            }}
                          >
                            <Text
                              style={[
                                typo.caption2,
                                { color: t.teal, fontWeight: '600' },
                              ]}
                            >
                              {Math.round(Number(r.fat_g))}g F
                            </Text>
                          </View>
                        </View>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color={t.textTer}
                      />
                    </Pressable>
                    {!isLast && (
                      <View
                        style={{
                          height: 0.5,
                          backgroundColor: t.hairline,
                          marginLeft: 12 + 40 + 12,
                        }}
                      />
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* Meal name */}
          <View
            style={{
              marginHorizontal: space.lg,
              marginTop: space.md,
            }}
          >
            <TextInput
              value={mealName}
              onChangeText={(v) => {
                setMealName(v);
                if (selectedRecipe) setSelectedRecipe(null);
              }}
              placeholder="e.g. Chicken rice bowl"
              placeholderTextColor={t.textTer}
              autoCapitalize="sentences"
              returnKeyType="done"
              style={[
                typo.body,
                {
                  backgroundColor: t.surface2,
                  borderRadius: radius.lg,
                  paddingHorizontal: space.md,
                  paddingVertical: space.sm,
                  color: t.text,
                },
              ]}
            />
          </View>

          {/* Planned time */}
          <View
            style={{
              marginHorizontal: space.lg,
              marginTop: space.md,
              backgroundColor: t.surface,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: t.hairline,
              overflow: 'hidden',
            }}
          >
            <Pressable
              onPress={() =>
                setTimeIdx((i) => (i + 1) % PRESET_TIMES.length)
              }
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: space.lg,
                paddingVertical: 14,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text style={[typo.subhead, { color: t.textSec, flex: 1 }]}>
                Time
              </Text>
              <Text
                style={[
                  typo.subhead,
                  {
                    color: t.text,
                    fontVariant: ['tabular-nums'],
                  },
                ]}
              >
                {formatTime(PRESET_TIMES[timeIdx])}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={t.textTer}
                style={{ marginLeft: space.sm }}
              />
            </Pressable>
          </View>

          {/* Portion description */}
          <View
            style={{
              marginHorizontal: space.lg,
              marginTop: space.md,
            }}
          >
            <TextInput
              value={portion}
              onChangeText={setPortion}
              placeholder="e.g. 1 serving, 300g"
              placeholderTextColor={t.textTer}
              returnKeyType="done"
              style={[
                typo.body,
                {
                  backgroundColor: t.surface2,
                  borderRadius: radius.lg,
                  paddingHorizontal: space.md,
                  paddingVertical: space.sm,
                  color: t.text,
                },
              ]}
            />
          </View>

          {/* Macro inputs */}
          <View
            style={{
              marginHorizontal: space.lg,
              marginTop: space.md,
              backgroundColor: t.surface,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: t.hairline,
              overflow: 'hidden',
            }}
          >
            <MacroInputRow
              label="Calories"
              value={cal}
              onChangeText={setCal}
              color={t.primary}
              unit="kcal"
              t={t}
            />
            <View style={{ height: 0.5, backgroundColor: t.hairline, marginLeft: space.lg }} />
            <MacroInputRow
              label="Protein"
              value={protein}
              onChangeText={setProtein}
              color={t.protein}
              unit="g"
              t={t}
            />
            <View style={{ height: 0.5, backgroundColor: t.hairline, marginLeft: space.lg }} />
            <MacroInputRow
              label="Carbs"
              value={carbs}
              onChangeText={setCarbs}
              color={t.carbs}
              unit="g"
              t={t}
            />
            <View style={{ height: 0.5, backgroundColor: t.hairline, marginLeft: space.lg }} />
            <MacroInputRow
              label="Fat"
              value={fat}
              onChangeText={setFat}
              color={t.fat}
              unit="g"
              t={t}
            />
          </View>

          {/* Recipes */}
          <Text
            style={[
              typo.caption2,
              {
                color: t.textTer,
                letterSpacing: 0.06,
                textTransform: 'uppercase',
                fontWeight: '700',
                paddingHorizontal: space.lg,
                paddingTop: space.xl,
                paddingBottom: space.xs,
              },
            ]}
          >
            Pick from my recipes
          </Text>
          {recipesLoading ? (
            <View style={{ alignItems: 'center', paddingVertical: space.xl }}>
              <ActivityIndicator color={t.primary} />
            </View>
          ) : recipes.length === 0 ? (
            <Text
              style={[
                typo.footnote,
                {
                  color: t.textTer,
                  paddingHorizontal: space.lg,
                  paddingTop: space.sm,
                },
              ]}
            >
              No saved recipes yet.
            </Text>
          ) : (
            <View
              style={{
                marginHorizontal: space.lg,
                backgroundColor: t.surface,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: t.hairline,
                overflow: 'hidden',
              }}
            >
              {recipes.map((r, i) => {
                const sel = selectedRecipe?.id === r.id;
                const isLast = i === recipes.length - 1;
                return (
                  <View key={r.id}>
                    <Pressable
                      onPress={() => pickRecipe(r)}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: space.lg,
                        paddingVertical: 12,
                        backgroundColor: sel ? t.primarySoft : 'transparent',
                        opacity: pressed ? 0.6 : 1,
                      })}
                    >
                      <View style={{ flex: 1, paddingRight: space.sm }}>
                        <Text
                          style={[
                            typo.subheadEm,
                            { color: sel ? t.primary : t.text },
                          ]}
                          numberOfLines={1}
                        >
                          {r.name}
                        </Text>
                        <Text
                          style={[
                            typo.caption1,
                            { color: t.textSec, marginTop: 2 },
                          ]}
                        >
                          {`${r.perServing.calories} kcal · ${r.perServing.protein_g}p · ${r.perServing.carbs_g}c · ${r.perServing.fat_g}f per serving`}
                        </Text>
                      </View>
                      {sel && (
                        <Ionicons
                          name="checkmark-circle"
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
                          marginLeft: space.lg,
                        }}
                      />
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>

        <View
          style={{
            paddingHorizontal: space.lg,
            paddingTop: space.sm,
            paddingBottom: insets.bottom + space.md,
          }}
        >
          <Pressable
            onPress={handleSave}
            disabled={!canSave}
            style={({ pressed }) => ({
              height: 52,
              borderRadius: radius.lg,
              backgroundColor: t.primary,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: !canSave ? 0.4 : pressed ? 0.85 : 1,
            })}
          >
            {saving ? (
              <ActivityIndicator color={t.textOnPrim} />
            ) : (
              <Text style={[typo.headline, { color: t.textOnPrim }]}>
                Add to plan
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
