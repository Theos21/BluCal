import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { radius, space, type as typo, useTheme, type Theme } from '../lib/theme';
import Toast from '../components/Toast';
import { useToast } from '../lib/useToast';
import { useAuth } from '../lib/AuthContext';
import { addRecipe } from '../lib/db';
import { sessionState } from '../lib/sessionState';
import { importRecipeFromUrl } from '../lib/recipeImport';
import { searchFoods, type FoodSearchResult } from '../lib/foodSearch';

const YIELD_UNITS = ['g', 'oz', 'ml', 'cups', 'pieces'] as const;

type Ingredient = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  cal: number;
  p: number;
  c: number;
  f: number;
};

// ── Small helpers ────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: string }) {
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
          paddingHorizontal: space.lg,
          paddingTop: space.xl,
          paddingBottom: space.xs,
        },
      ]}
    >
      {children}
    </Text>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View
      style={{
        backgroundColor: t.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: t.hairline,
        overflow: 'hidden',
        marginHorizontal: space.lg,
      }}
    >
      {children}
    </View>
  );
}

function Separator({ t, inset = 0 }: { t: Theme; inset?: number }) {
  return (
    <View
      style={{
        height: 0.5,
        backgroundColor: t.hairline,
        marginLeft: inset,
      }}
    />
  );
}

function StepperButton({
  icon,
  onPress,
  disabled,
}: {
  icon: 'remove' | 'add';
  onPress: () => void;
  disabled?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: t.surface2,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
      })}
    >
      <Ionicons name={icon} size={18} color={t.textSec} />
    </Pressable>
  );
}

function MacroTile({
  label,
  value,
  bg,
  valueColor,
  labelColor,
  t,
}: {
  label: string;
  value: string;
  bg: string;
  valueColor: string;
  labelColor: string;
  t: Theme;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: bg,
        borderRadius: radius.md,
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
      <Text
        style={[
          typo.title2,
          {
            color: valueColor,
            marginTop: space.xs,
            fontVariant: ['tabular-nums'],
          },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────
export default function RecipeBuilder() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { user } = useAuth();

  const [recipeName, setRecipeName] = useState('');
  const [servings, setServings] = useState(1);
  const [yieldAmount, setYieldAmount] = useState('');
  const [yieldUnitIdx, setYieldUnitIdx] = useState(0);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [saving, setSaving] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);

  const [showIngredientSearch, setShowIngredientSearch] = useState(false);
  const [ingredientQuery, setIngredientQuery] = useState('');
  const [ingredientResults, setIngredientResults] = useState<
    FoodSearchResult[]
  >([]);
  const [searchingIngredients, setSearchingIngredients] = useState(false);
  const [selectedIngredientFood, setSelectedIngredientFood] =
    useState<FoodSearchResult | null>(null);
  const [ingredientQuantity, setIngredientQuantity] = useState('100');
  const [ingredientUnit, setIngredientUnit] = useState('g');
  const [showIngredientQuantity, setShowIngredientQuantity] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totals = ingredients.reduce(
    (acc, i) => ({
      cal: acc.cal + i.cal,
      p: acc.p + i.p,
      c: acc.c + i.c,
      f: acc.f + i.f,
    }),
    { cal: 0, p: 0, c: 0, f: 0 },
  );
  const perServing = {
    cal: Math.round(totals.cal / servings),
    p: Math.round(totals.p / servings),
    c: Math.round(totals.c / servings),
    f: Math.round(totals.f / servings),
  };

  const canSave = recipeName.trim().length > 0 && ingredients.length > 0;

  const handleSave = async () => {
    if (!canSave || !user || saving) return;
    setSaving(true);
    try {
      const totalYield = yieldAmount;
      const yieldUnit = YIELD_UNITS[yieldUnitIdx];
      await addRecipe(
        {
          user_id: user.id,
          name: recipeName.trim(),
          servings,
          total_yield: totalYield ? Number(totalYield) : null,
          yield_unit: yieldUnit || null,
        },
        ingredients.map((ing, i) => ({
          recipe_id: '',
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit,
          calories: ing.cal,
          protein_g: ing.p,
          carbs_g: ing.c,
          fat_g: ing.f,
          custom_food_id: null,
          food_database_id: null,
          sort_order: i,
        })),
      );
      sessionState.setNeedsRefresh(true);
      toast.show('Recipe saved to your library', 'success');
      setTimeout(() => router.back(), 800);
    } catch {
      toast.show('Could not save recipe. Try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleImport = async () => {
    const url = importUrl.trim();
    if (!url || importing) return;
    setImporting(true);
    try {
      const recipe = await importRecipeFromUrl(url);
      setRecipeName(recipe.name);
      setServings(recipe.servings);
      setIngredients(
        recipe.ingredients.map((ing, i) => ({
          id: String(i + 1),
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit,
          cal: ing.calories,
          p: ing.protein_g,
          c: ing.carbs_g,
          f: ing.fat_g,
        })),
      );
      setImportUrl('');
      setImportOpen(false);
      toast.show(`Imported: ${recipe.name}`, 'success');
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : 'Could not import recipe. Try again.';
      toast.show(message, 'error');
    } finally {
      setImporting(false);
    }
  };

  const removeIngredient = (id: string) => {
    setIngredients((prev) => prev.filter((i) => i.id !== id));
  };

  const confirmRemoveIngredient = (ingredient: Ingredient) => {
    Alert.alert(
      'Remove ingredient?',
      `Remove ${ingredient.name} from this recipe?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeIngredient(ingredient.id),
        },
      ],
    );
  };

  // Scale a searched food's per-serving macros to the chosen quantity/unit.
  // Used by both the live preview and handleConfirmIngredient so they agree.
  const ingredientScaleFactor = (
    food: FoodSearchResult,
    qty: number,
    unit: string,
  ): number => {
    if (unit === 'serving') return qty;
    const base = food.serving_size || 100;
    if (unit === 'oz') return (qty * 28.3495) / base;
    return qty / base;
  };

  const handleIngredientSearch = (text: string) => {
    setIngredientQuery(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!text.trim()) {
      setIngredientResults([]);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      setSearchingIngredients(true);
      try {
        const results = await searchFoods(text);
        setIngredientResults(results);
      } catch {
        toast.show('Search failed. Try again.', 'error');
      } finally {
        setSearchingIngredients(false);
      }
    }, 500);
  };

  const handleSelectIngredient = (food: FoodSearchResult) => {
    setSelectedIngredientFood(food);
    setIngredientQuantity('100');
    setIngredientUnit('g');
    setShowIngredientQuantity(true);
  };

  const handleConfirmIngredient = () => {
    if (!selectedIngredientFood) return;
    const qty = Number(ingredientQuantity) || 100;
    const factor = ingredientScaleFactor(
      selectedIngredientFood,
      qty,
      ingredientUnit,
    );
    const ingredient: Ingredient = {
      id: Date.now().toString(),
      name: selectedIngredientFood.name,
      quantity: qty,
      unit: ingredientUnit,
      cal: Math.round(selectedIngredientFood.calories * factor),
      p: Math.round(selectedIngredientFood.protein_g * factor * 10) / 10,
      c: Math.round(selectedIngredientFood.carbs_g * factor * 10) / 10,
      f: Math.round(selectedIngredientFood.fat_g * factor * 10) / 10,
    };
    setIngredients((prev) => [...prev, ingredient]);
    setShowIngredientQuantity(false);
    setShowIngredientSearch(false);
    setIngredientQuery('');
    setIngredientResults([]);
  };

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
          <View
            style={{
              marginTop: 12,
              paddingHorizontal: space.lg,
              flexDirection: 'row',
              alignItems: 'center',
              minHeight: 32,
            }}
          >
            <Pressable
              hitSlop={6}
              onPress={() => setImportOpen(true)}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Text style={[typo.footnote, { color: t.primary }]}>
                Import URL
              </Text>
            </Pressable>
            <Text
              style={[
                typo.title3,
                {
                  color: t.text,
                  flex: 1,
                  textAlign: 'center',
                },
              ]}
            >
              New recipe
            </Text>
            <Pressable
              onPress={() => router.back()}
              hitSlop={6}
              style={({ pressed }) => ({
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
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: space.xl }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Section 1 — Recipe details */}
          <View style={{ marginTop: space.lg }} />
          <SectionCard>
            {/* Recipe name */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: space.lg,
                paddingVertical: 12,
                gap: space.md,
              }}
            >
              <Text style={[typo.subhead, { color: t.textSec }]}>
                Recipe name
              </Text>
              <TextInput
                value={recipeName}
                onChangeText={setRecipeName}
                placeholder="e.g. Chicken fried rice"
                placeholderTextColor={t.textTer}
                autoCapitalize="words"
                returnKeyType="done"
                style={[
                  typo.body,
                  {
                    flex: 1,
                    color: t.text,
                    textAlign: 'right',
                    padding: 0,
                  },
                ]}
              />
            </View>
            <Separator t={t} inset={space.lg} />

            {/* Servings stepper */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: space.lg,
                paddingVertical: 12,
                gap: space.md,
              }}
            >
              <Text style={[typo.subhead, { color: t.textSec, flex: 1 }]}>
                Servings
              </Text>
              <StepperButton
                icon="remove"
                onPress={() =>
                  setServings((s) => Math.max(1, s - 1))
                }
                disabled={servings <= 1}
              />
              <Text
                style={[
                  typo.headline,
                  {
                    color: t.text,
                    minWidth: 28,
                    textAlign: 'center',
                    fontVariant: ['tabular-nums'],
                  },
                ]}
              >
                {servings}
              </Text>
              <StepperButton
                icon="add"
                onPress={() => setServings((s) => Math.min(50, s + 1))}
                disabled={servings >= 50}
              />
            </View>
            <Separator t={t} inset={space.lg} />

            {/* Total yield */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: space.lg,
                paddingVertical: 12,
                gap: space.sm,
              }}
            >
              <Text style={[typo.subhead, { color: t.textSec, flex: 1 }]}>
                Total yield
              </Text>
              <TextInput
                value={yieldAmount}
                onChangeText={setYieldAmount}
                keyboardType="decimal-pad"
                returnKeyType="done"
                placeholder="0"
                placeholderTextColor={t.textTer}
                style={{
                  width: 60,
                  backgroundColor: t.surface2,
                  borderRadius: radius.sm,
                  paddingHorizontal: 8,
                  paddingVertical: 8,
                  ...typo.subhead,
                  color: t.text,
                  textAlign: 'center',
                }}
              />
              <Pressable
                onPress={() =>
                  setYieldUnitIdx((i) => (i + 1) % YIELD_UNITS.length)
                }
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  backgroundColor: t.surface2,
                  borderRadius: radius.sm,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Text style={[typo.subhead, { color: t.text }]}>
                  {YIELD_UNITS[yieldUnitIdx]}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={14}
                  color={t.textSec}
                />
              </Pressable>
            </View>
          </SectionCard>

          {/* Section 2 — Ingredients */}
          <SectionLabel>Ingredients</SectionLabel>
          {ingredients.length === 0 ? (
            <View
              style={{
                alignItems: 'center',
                paddingVertical: space.xxxl,
                gap: space.sm,
              }}
            >
              <Ionicons name="flask-outline" size={48} color={t.textTer} />
              <Text style={[typo.subhead, { color: t.textTer }]}>
                No ingredients added
              </Text>
            </View>
          ) : (
            <SectionCard>
              {ingredients.map((ing, i) => {
                const isLast = i === ingredients.length - 1;
                return (
                  <View key={ing.id}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: space.lg,
                        paddingVertical: 12,
                        gap: space.md,
                      }}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          style={[typo.subheadEm, { color: t.text }]}
                          numberOfLines={1}
                        >
                          {ing.name}
                        </Text>
                        <Text
                          style={[
                            typo.caption1,
                            { color: t.textSec, marginTop: 2 },
                          ]}
                        >
                          {`${ing.quantity} ${ing.unit}`}
                        </Text>
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
                        {`${ing.cal} kcal`}
                      </Text>
                      <Pressable
                        hitSlop={6}
                        onPress={() => confirmRemoveIngredient(ing)}
                        style={({ pressed }) => ({
                          opacity: pressed ? 0.6 : 1,
                        })}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={18}
                          color={t.danger}
                        />
                      </Pressable>
                    </View>
                    {!isLast && <Separator t={t} inset={space.lg} />}
                  </View>
                );
              })}
            </SectionCard>
          )}

          {/* Add ingredient dashed row */}
          <Pressable
            onPress={() => setShowIngredientSearch(true)}
            style={({ pressed }) => ({
              marginHorizontal: space.lg,
              marginTop: space.md,
              borderRadius: radius.lg,
              borderWidth: 1.5,
              borderColor: `${t.primary}66`,
              borderStyle: 'dashed',
              padding: space.md,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: space.sm,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Ionicons name="add-outline" size={20} color={t.primary} />
            <Text style={[typo.subhead, { color: t.primary }]}>
              Add ingredient
            </Text>
          </Pressable>

          {/* Section 3 — Per serving */}
          <SectionLabel>Per serving</SectionLabel>
          <View
            style={{
              marginHorizontal: space.lg,
              gap: space.sm,
            }}
          >
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <MacroTile
                label="Calories"
                value={String(perServing.cal)}
                bg={t.surface2}
                valueColor={t.text}
                labelColor={t.textTer}
                t={t}
              />
              <MacroTile
                label="Protein"
                value={`${perServing.p}g`}
                bg={t.primarySoft}
                valueColor={t.protein}
                labelColor={t.protein}
                t={t}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <MacroTile
                label="Carbs"
                value={`${perServing.c}g`}
                bg={t.warnSoft}
                valueColor={t.carbs}
                labelColor={t.carbs}
                t={t}
              />
              <MacroTile
                label="Fat"
                value={`${perServing.f}g`}
                bg={t.tealSoft}
                valueColor={t.teal}
                labelColor={t.teal}
                t={t}
              />
            </View>
          </View>
        </ScrollView>

        {/* Save button */}
        <View
          style={{
            paddingHorizontal: space.lg,
            paddingTop: space.sm,
            paddingBottom: insets.bottom + space.md,
          }}
        >
          <Pressable
            onPress={handleSave}
            disabled={!canSave || saving}
            style={({ pressed }) => ({
              height: 52,
              borderRadius: radius.lg,
              backgroundColor: t.teal,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: saving ? 0.6 : canSave ? (pressed ? 0.85 : 1) : 0.4,
            })}
          >
            {saving ? (
              <ActivityIndicator color={t.textOnPrim} />
            ) : (
              <Text style={[typo.headline, { color: t.textOnPrim }]}>
                Save recipe
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Import URL sheet */}
      <Modal
        visible={importOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setImportOpen(false)}
      >
        <Pressable
          onPress={() => setImportOpen(false)}
          style={{
            flex: 1,
            backgroundColor: t.scrim,
            justifyContent: 'flex-end',
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: t.surface,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              padding: space.xl,
              paddingBottom: insets.bottom + space.lg,
            }}
          >
            <Text style={[typo.title3, { color: t.text }]}>
              Import recipe
            </Text>
            <Text
              style={[
                typo.subhead,
                { color: t.textSec, marginTop: space.xs },
              ]}
            >
              Paste a URL from any recipe website.
            </Text>

            <TextInput
              value={importUrl}
              onChangeText={setImportUrl}
              placeholder="https://..."
              placeholderTextColor={t.textTer}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={handleImport}
              style={[
                typo.body,
                {
                  marginTop: space.lg,
                  backgroundColor: t.surface2,
                  borderRadius: radius.lg,
                  paddingHorizontal: space.lg,
                  paddingVertical: space.sm,
                  color: t.text,
                },
              ]}
            />

            <Pressable
              onPress={handleImport}
              disabled={importing || !importUrl.trim()}
              style={({ pressed }) => ({
                marginTop: space.lg,
                height: 52,
                borderRadius: radius.lg,
                backgroundColor: t.primary,
                alignItems: 'center',
                justifyContent: 'center',
                opacity:
                  importing || !importUrl.trim()
                    ? 0.4
                    : pressed
                      ? 0.85
                      : 1,
              })}
            >
              {importing ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.sm,
                  }}
                >
                  <ActivityIndicator color={t.textOnPrim} />
                  <Text style={[typo.headline, { color: t.textOnPrim }]}>
                    Importing...
                  </Text>
                </View>
              ) : (
                <Text style={[typo.headline, { color: t.textOnPrim }]}>
                  Import
                </Text>
              )}
            </Pressable>

            <Pressable
              hitSlop={6}
              onPress={() => setImportOpen(false)}
              style={({ pressed }) => ({
                alignSelf: 'center',
                marginTop: space.md,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text style={[typo.subhead, { color: t.textSec }]}>
                Cancel
              </Text>
            </Pressable>
          </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* Ingredient search sheet */}
      <Modal
        visible={showIngredientSearch}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowIngredientSearch(false)}
      >
        <View style={{ flex: 1, backgroundColor: t.bg }}>
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: space.lg,
              paddingTop: space.xl,
            }}
          >
            <Text style={[typo.title2, { color: t.text, fontWeight: '700' }]}>
              Add Ingredient
            </Text>
            <Pressable
              hitSlop={8}
              onPress={() => {
                setShowIngredientSearch(false);
                setIngredientQuery('');
                setIngredientResults([]);
              }}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Ionicons name="close-circle" size={28} color={t.textTer} />
            </Pressable>
          </View>

          {/* Search bar */}
          <View
            style={{
              marginHorizontal: space.lg,
              marginBottom: space.sm,
              backgroundColor: t.surface,
              borderRadius: radius.lg,
              flexDirection: 'row',
              alignItems: 'center',
              padding: space.md,
              gap: space.sm,
            }}
          >
            <Ionicons name="search-outline" size={18} color={t.textTer} />
            <TextInput
              style={[typo.body, { flex: 1, color: t.text, padding: 0 }]}
              placeholder="Search foods…"
              placeholderTextColor={t.textTer}
              value={ingredientQuery}
              onChangeText={handleIngredientSearch}
              autoFocus
              returnKeyType="search"
            />
            {searchingIngredients && (
              <ActivityIndicator size="small" color={t.primary} />
            )}
          </View>

          {/* Results */}
          <FlatList
            style={{ flex: 1 }}
            data={ingredientResults}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handleSelectIngredient(item)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: space.md,
                  paddingHorizontal: space.lg,
                  gap: space.md,
                  backgroundColor: pressed ? t.surface2 : 'transparent',
                })}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: t.primarySoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons
                    name="nutrition-outline"
                    size={20}
                    color={t.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      typo.subhead,
                      { color: t.text, fontWeight: '600' },
                    ]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  {item.brand && (
                    <Text style={[typo.caption1, { color: t.textSec }]}>
                      {item.brand}
                    </Text>
                  )}
                  <View
                    style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}
                  >
                    <Text style={[typo.caption2, { color: t.textTer }]}>
                      {item.calories} cal
                    </Text>
                    <Text style={[typo.caption2, { color: t.primary }]}>
                      {Math.round(item.protein_g)}g P
                    </Text>
                    <Text style={[typo.caption2, { color: t.warn }]}>
                      {Math.round(item.carbs_g)}g C
                    </Text>
                    <Text style={[typo.caption2, { color: t.teal }]}>
                      {Math.round(item.fat_g)}g F
                    </Text>
                  </View>
                </View>
                <Ionicons
                  name="add-circle-outline"
                  size={24}
                  color={t.primary}
                />
              </Pressable>
            )}
            ListEmptyComponent={
              ingredientQuery.length > 0 && !searchingIngredients ? (
                <View style={{ alignItems: 'center', padding: space.xl }}>
                  <Text style={[typo.subhead, { color: t.textTer }]}>
                    No results found
                  </Text>
                </View>
              ) : null
            }
          />
        </View>

        {/* Quantity selector within the ingredient search */}
        <Modal
          visible={showIngredientQuantity}
          animationType="slide"
          presentationStyle="formSheet"
          onRequestClose={() => setShowIngredientQuantity(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1, backgroundColor: t.bg }}
          >
          <View style={{ flex: 1, padding: space.lg }}>
            <Text
              style={[
                typo.title2,
                { color: t.text, fontWeight: '700', marginBottom: space.sm },
              ]}
            >
              How much?
            </Text>
            {selectedIngredientFood && (
              <Text
                style={[
                  typo.subhead,
                  { color: t.textSec, marginBottom: space.lg },
                ]}
              >
                {selectedIngredientFood.name}
              </Text>
            )}

            {/* Quantity input + unit selector */}
            <View
              style={{
                flexDirection: 'row',
                gap: space.sm,
                marginBottom: space.lg,
              }}
            >
              <TextInput
                style={{
                  flex: 1,
                  backgroundColor: t.surface,
                  borderRadius: radius.lg,
                  padding: space.md,
                  color: t.text,
                  fontSize: 24,
                  fontWeight: '700',
                  textAlign: 'center',
                }}
                keyboardType="numeric"
                value={ingredientQuantity}
                onChangeText={setIngredientQuantity}
                selectTextOnFocus
              />
              <View style={{ flexDirection: 'column', gap: space.xs }}>
                {['g', 'oz', 'serving'].map((u) => (
                  <Pressable
                    key={u}
                    onPress={() => setIngredientUnit(u)}
                    style={{
                      backgroundColor:
                        ingredientUnit === u ? t.primary : t.surface,
                      borderRadius: radius.md,
                      paddingHorizontal: space.md,
                      paddingVertical: space.sm,
                    }}
                  >
                    <Text
                      style={[
                        typo.caption1,
                        {
                          color:
                            ingredientUnit === u ? t.textOnPrim : t.textSec,
                          fontWeight: '600',
                        },
                      ]}
                    >
                      {u}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Live macro preview */}
            {selectedIngredientFood &&
              (() => {
                const qty = Number(ingredientQuantity) || 0;
                const factor = ingredientScaleFactor(
                  selectedIngredientFood,
                  qty,
                  ingredientUnit,
                );
                return (
                  <View
                    style={{
                      backgroundColor: t.surface,
                      borderRadius: radius.lg,
                      padding: space.md,
                      flexDirection: 'row',
                      justifyContent: 'space-around',
                      marginBottom: space.lg,
                    }}
                  >
                    <View style={{ alignItems: 'center' }}>
                      <Text
                        style={[
                          typo.title3,
                          { color: t.text, fontWeight: '700' },
                        ]}
                      >
                        {Math.round(selectedIngredientFood.calories * factor)}
                      </Text>
                      <Text style={[typo.caption2, { color: t.textTer }]}>
                        cal
                      </Text>
                    </View>
                    <View style={{ alignItems: 'center' }}>
                      <Text
                        style={[
                          typo.title3,
                          { color: t.primary, fontWeight: '700' },
                        ]}
                      >
                        {Math.round(
                          selectedIngredientFood.protein_g * factor * 10,
                        ) / 10}
                        g
                      </Text>
                      <Text style={[typo.caption2, { color: t.textTer }]}>
                        protein
                      </Text>
                    </View>
                    <View style={{ alignItems: 'center' }}>
                      <Text
                        style={[
                          typo.title3,
                          { color: t.warn, fontWeight: '700' },
                        ]}
                      >
                        {Math.round(
                          selectedIngredientFood.carbs_g * factor * 10,
                        ) / 10}
                        g
                      </Text>
                      <Text style={[typo.caption2, { color: t.textTer }]}>
                        carbs
                      </Text>
                    </View>
                    <View style={{ alignItems: 'center' }}>
                      <Text
                        style={[
                          typo.title3,
                          { color: t.teal, fontWeight: '700' },
                        ]}
                      >
                        {Math.round(
                          selectedIngredientFood.fat_g * factor * 10,
                        ) / 10}
                        g
                      </Text>
                      <Text style={[typo.caption2, { color: t.textTer }]}>
                        fat
                      </Text>
                    </View>
                  </View>
                );
              })()}

            <View style={{ flex: 1 }} />

            {/* Buttons */}
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Pressable
                onPress={() => setShowIngredientQuantity(false)}
                style={({ pressed }) => ({
                  flex: 1,
                  backgroundColor: t.surface2,
                  borderRadius: radius.lg,
                  padding: space.md,
                  alignItems: 'center',
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Text
                  style={[typo.subhead, { color: t.text, fontWeight: '600' }]}
                >
                  Back
                </Text>
              </Pressable>
              <Pressable
                onPress={handleConfirmIngredient}
                style={({ pressed }) => ({
                  flex: 2,
                  backgroundColor: t.primary,
                  borderRadius: radius.lg,
                  padding: space.md,
                  alignItems: 'center',
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text
                  style={[
                    typo.subhead,
                    { color: t.textOnPrim, fontWeight: '700' },
                  ]}
                >
                  Add to recipe
                </Text>
              </Pressable>
            </View>
          </View>
          </KeyboardAvoidingView>
        </Modal>
      </Modal>

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
