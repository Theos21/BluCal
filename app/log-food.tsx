import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { radius, space, type as typo, useTheme, type Theme } from '../lib/theme';
import Toast from '../components/Toast';
import { useToast } from '../lib/useToast';
import { useAuth } from '../lib/AuthContext';
import {
  addFoodEntry,
  getRecentFoods,
  getRecipesWithMacros,
  type RecipeWithMacros,
} from '../lib/db';
import { searchFoods, type FoodSearchResult } from '../lib/foodSearch';
import { sessionState } from '../lib/sessionState';
import type { FoodEntry } from '../lib/types';

type RichRow = {
  id: string;
  name: string;
  brand?: string | null;
  hint?: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  onAdd: () => void;
};

const formatFoodName = (name: string): string => {
  if (!name) return '';
  if (name === name.toUpperCase()) {
    return name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return name.replace(/\b\w/g, (c) => c.toUpperCase());
};

const formatBrandName = (brand: string | null | undefined): string | null => {
  if (!brand) return null;
  const first = brand.split(',')[0].trim();
  if (!first) return null;
  if (first === first.toUpperCase()) {
    return first.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return first.replace(/\b\w/g, (c) => c.toUpperCase());
};

type FoodIconKind = 'protein' | 'fat' | 'carb' | 'default';

const getFoodIconKind = (
  cal: number,
  p: number,
  c: number,
  f: number,
): FoodIconKind => {
  if (p > 15 && p * 4 > cal * 0.3) return 'protein';
  if (f > 15 || cal > 400) return 'fat';
  if (c > 30) return 'carb';
  return 'default';
};

const getFoodIcon = (
  kind: FoodIconKind,
  t: Theme,
): {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
} => {
  switch (kind) {
    case 'protein':
      return {
        name: 'barbell-outline',
        color: t.primary,
        bg: t.primarySoft,
      };
    case 'fat':
      return { name: 'flame-outline', color: t.warn, bg: t.warnSoft };
    case 'carb':
      return { name: 'leaf-outline', color: t.teal, bg: t.tealSoft };
    default:
      return {
        name: 'nutrition-outline',
        color: t.primary,
        bg: t.primarySoft,
      };
  }
};

function Header() {
  const t = useTheme();
  return (
    <View>
      <View style={{ alignItems: 'center' }}>
        <View
          style={{
            width: 36,
            height: 4,
            borderRadius: 999,
            backgroundColor: t.surface3,
            marginTop: 8,
          }}
        />
      </View>
      <View
        style={{
          marginTop: 12,
          paddingHorizontal: space.lg,
          height: 28,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={({ pressed }) => ({
            width: 64,
            alignItems: 'flex-start',
            opacity: pressed ? 0.5 : 1,
          })}
        >
          <Ionicons name="close-outline" size={24} color={t.textSec} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[typo.title3, { color: t.text }]}>Log food</Text>
        </View>
        <View style={{ width: 64 }} />
      </View>
    </View>
  );
}

function SearchBar({
  value,
  onChangeText,
  recognizing,
  micPulse,
  onMicPress,
}: {
  value: string;
  onChangeText: (v: string) => void;
  recognizing: boolean;
  micPulse: Animated.Value;
  onMicPress: () => void;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        marginHorizontal: space.lg,
        marginTop: space.md,
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
        value={value}
        onChangeText={onChangeText}
        placeholder="Search food or scan barcode…"
        placeholderTextColor={t.textTer}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        style={[typo.body, { flex: 1, color: t.text, padding: 0 }]}
      />
      <Pressable hitSlop={6} onPress={() => router.push('/barcode-scanner')}>
        <Ionicons name="barcode-outline" size={22} color={t.textSec} />
      </Pressable>
      <Pressable hitSlop={6} onPress={onMicPress}>
        <Animated.View style={{ transform: [{ scale: micPulse }] }}>
          <Ionicons
            name={recognizing ? 'mic' : 'mic-outline'}
            size={20}
            color={recognizing ? t.danger : t.textSec}
          />
        </Animated.View>
      </Pressable>
    </View>
  );
}

function QuickActions() {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: space.md,
        paddingHorizontal: space.lg,
        marginTop: space.md,
      }}
    >
      <Pressable
        onPress={() => router.push('/barcode-scanner')}
        style={({ pressed }) => ({
          flex: 1,
          backgroundColor: t.surface2,
          borderRadius: radius.lg,
          padding: 12,
          alignItems: 'center',
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Ionicons name="barcode-outline" size={28} color={t.primary} />
        <Text style={[typo.footnote, { color: t.textSec, marginTop: space.xs }]}>
          Scan barcode
        </Text>
      </Pressable>
      <Pressable
        onPress={() => router.push('/bluai')}
        style={({ pressed }) => ({
          flex: 1,
          backgroundColor: t.primarySoft,
          borderRadius: radius.lg,
          padding: 12,
          alignItems: 'center',
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Ionicons name="sparkles-outline" size={28} color={t.primary} />
        <Text
          style={[
            typo.footnote,
            { color: t.primary, fontWeight: '600', marginTop: space.xs },
          ]}
        >
          BluAI
        </Text>
      </Pressable>
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
        },
      ]}
    >
      {label}
    </Text>
  );
}

function RichFoodRowItem({
  row,
  showDivider,
}: {
  row: RichRow;
  showDivider: boolean;
}) {
  const t = useTheme();
  const displayName = formatFoodName(row.name);
  const displayBrand = formatBrandName(row.brand ?? null);

  const cleanName =
    displayBrand &&
    displayName.toLowerCase().startsWith(displayBrand.toLowerCase())
      ? displayName.slice(displayBrand.length).trim()
      : displayName;
  const finalName = cleanName || displayName;

  const subtitle = displayBrand ?? row.hint ?? null;

  const iconKind = getFoodIconKind(
    row.calories,
    Number(row.protein_g),
    Number(row.carbs_g),
    Number(row.fat_g),
  );
  const icon = getFoodIcon(iconKind, t);

  return (
    <View>
      <Pressable
        onPress={row.onAdd}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 12,
          gap: 12,
          backgroundColor: pressed ? t.surface2 : 'transparent',
        })}
      >
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: 14,
            backgroundColor: icon.bg,
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Ionicons name={icon.name} size={22} color={icon.color} />
        </View>

        <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
          <Text
            style={[typo.subhead, { color: t.text, fontWeight: '600' }]}
            numberOfLines={1}
          >
            {finalName}
          </Text>
          {subtitle && (
            <Text
              style={[
                typo.caption1,
                { color: t.textSec, fontWeight: '500' },
              ]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          )}
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
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
                {row.calories} cal
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
                {Math.round(Number(row.protein_g))}g P
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
                {Math.round(Number(row.carbs_g))}g C
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
                {Math.round(Number(row.fat_g))}g F
              </Text>
            </View>
          </View>
        </View>

        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: t.primary,
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Ionicons name="add" size={22} color={t.textOnPrim} />
        </View>
      </Pressable>
      {showDivider && (
        <View style={{ height: 0.5, backgroundColor: t.hairline }} />
      )}
    </View>
  );
}

function Section({
  label,
  rows,
  emptyState,
}: {
  label: string;
  rows: RichRow[];
  emptyState?: React.ReactNode;
}) {
  return (
    <View style={{ paddingHorizontal: space.lg, marginTop: space.xl }}>
      <SectionLabel label={label} />
      <View style={{ marginTop: space.xs }}>
        {rows.length === 0 && emptyState
          ? emptyState
          : rows.map((row, i) => (
              <RichFoodRowItem
                key={row.id}
                row={row}
                showDivider={i < rows.length - 1}
              />
            ))}
      </View>
    </View>
  );
}

function RecentsEmptyState() {
  const t = useTheme();
  return (
    <View
      style={{
        alignItems: 'center',
        paddingVertical: space.xxl,
      }}
    >
      <Ionicons name="search-outline" size={36} color={t.textTer} />
      <Text
        style={[typo.subhead, { color: t.textTer, marginTop: space.sm }]}
      >
        No recent foods yet
      </Text>
      <Text
        style={[typo.footnote, { color: t.textTer, marginTop: space.xs }]}
      >
        Foods you log will appear here
      </Text>
    </View>
  );
}

function RecipesEmptyState() {
  const t = useTheme();
  return (
    <View
      style={{
        alignItems: 'center',
        paddingVertical: space.xl,
      }}
    >
      <Text style={[typo.footnote, { color: t.textTer }]}>
        No recipes yet
      </Text>
    </View>
  );
}

function SearchResultsList({
  results,
  onSelect,
}: {
  results: FoodSearchResult[];
  onSelect: (r: FoodSearchResult) => void;
}) {
  const rows: RichRow[] = results.map((r) => ({
    id: r.id,
    name: r.name,
    brand: r.brand,
    calories: r.calories,
    protein_g: r.protein_g,
    carbs_g: r.carbs_g,
    fat_g: r.fat_g,
    onAdd: () => onSelect(r),
  }));
  return (
    <View style={{ paddingHorizontal: space.lg, marginTop: space.xl }}>
      <SectionLabel label="Search results" />
      <View style={{ marginTop: space.xs }}>
        {rows.map((row, i) => (
          <RichFoodRowItem
            key={row.id}
            row={row}
            showDivider={i < rows.length - 1}
          />
        ))}
      </View>
    </View>
  );
}

function EmptySearchState({ query }: { query: string }) {
  const t = useTheme();
  return (
    <View
      style={{
        alignItems: 'center',
        paddingVertical: space.xxl,
        paddingHorizontal: space.xl,
      }}
    >
      <Ionicons name="search-outline" size={32} color={t.textTer} />
      <Text
        style={[
          typo.subhead,
          { color: t.textTer, marginTop: space.sm, textAlign: 'center' },
        ]}
      >
        {`No results for "${query}"`}
      </Text>
      <Text
        style={[
          typo.footnote,
          { color: t.textTer, marginTop: space.xs, textAlign: 'center' },
        ]}
      >
        Try a different search or create a custom food
      </Text>
    </View>
  );
}

export default function LogFood() {
  const t = useTheme();
  const toast = useToast();
  const { user } = useAuth();

  const [recentFoods, setRecentFoods] = useState<FoodEntry[]>([]);
  const [myRecipes, setMyRecipes] = useState<RecipeWithMacros[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [recognizing, setRecognizing] = useState(false);
  const micPulse = useRef(new Animated.Value(1)).current;

  useSpeechRecognitionEvent('start', () => setRecognizing(true));
  useSpeechRecognitionEvent('end', () => setRecognizing(false));
  useSpeechRecognitionEvent('result', (event) => {
    const first = event.results?.[0];
    if (event.isFinal && first?.transcript) {
      setSearchQuery(first.transcript);
      handleSearchChange(first.transcript);
    }
  });
  useSpeechRecognitionEvent('error', (event) => {
    console.error('Speech recognition error:', event.error, event.message);
    toast.show('Could not understand audio. Try again.', 'error');
  });

  useEffect(() => {
    if (recognizing) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(micPulse, {
            toValue: 1.3,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(micPulse, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      micPulse.stopAnimation();
      micPulse.setValue(1);
    }
  }, [recognizing, micPulse]);

  const handleVoiceInput = async () => {
    if (recognizing) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    const { granted } =
      await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) {
      toast.show('Microphone permission required for voice logging.', 'info');
      return;
    }
    ExpoSpeechRecognitionModule.start({
      lang: 'en-US',
      interimResults: false,
    });
  };

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    Promise.all([getRecentFoods(user.id), getRecipesWithMacros(user.id)])
      .then(([recent, recipes]) => {
        setRecentFoods(recent);
        setMyRecipes(recipes);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, []);

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!text.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
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

  const handleSelectFood = async (food: FoodSearchResult) => {
    if (!user) return;
    try {
      await addFoodEntry({
        user_id: user.id,
        logged_at: new Date().toISOString(),
        name: food.name,
        portion_description: `${food.serving_size}${food.serving_unit}`,
        quantity: 1,
        unit: food.serving_unit,
        calories: food.calories,
        protein_g: food.protein_g,
        carbs_g: food.carbs_g,
        fat_g: food.fat_g,
        fiber_g: food.fiber_g,
        sugar_g: food.sugar_g,
        sodium_mg: food.sodium_mg,
        saturated_fat_g: 0,
        cholesterol_mg: 0,
        food_database_id: food.id,
        barcode: food.barcode,
        source: 'search',
      });
      sessionState.setJustLoggedFood(food.name);
      toast.show(`Added: ${food.name}`, 'success');
      setTimeout(() => router.back(), 800);
    } catch {
      toast.show('Could not add food. Try again.', 'error');
    }
  };

  const handleReLog = async (entry: FoodEntry) => {
    if (!user) return;
    try {
      await addFoodEntry({
        user_id: user.id,
        logged_at: new Date().toISOString(),
        name: entry.name,
        portion_description: entry.portion_description,
        quantity: entry.quantity,
        unit: entry.unit,
        calories: entry.calories,
        protein_g: entry.protein_g,
        carbs_g: entry.carbs_g,
        fat_g: entry.fat_g,
        fiber_g: entry.fiber_g ?? 0,
        sugar_g: entry.sugar_g ?? 0,
        sodium_mg: entry.sodium_mg ?? 0,
        saturated_fat_g: entry.saturated_fat_g ?? 0,
        cholesterol_mg: entry.cholesterol_mg ?? 0,
        food_database_id: entry.food_database_id,
        barcode: entry.barcode,
        source: entry.source ?? 'manual',
      });
      sessionState.setJustLoggedFood(entry.name);
      toast.show(`Added: ${entry.name}`, 'success');
      setTimeout(() => router.back(), 800);
    } catch {
      toast.show('Could not add food. Try again.', 'error');
    }
  };

  const recentRows: RichRow[] = recentFoods.map((entry) => ({
    id: entry.id,
    name: entry.name,
    calories: entry.calories,
    protein_g: Number(entry.protein_g),
    carbs_g: Number(entry.carbs_g),
    fat_g: Number(entry.fat_g),
    onAdd: () => void handleReLog(entry),
  }));

  const handleLogRecipe = async (recipe: RecipeWithMacros) => {
    if (!user) return;
    try {
      await addFoodEntry({
        user_id: user.id,
        logged_at: new Date().toISOString(),
        name: recipe.name,
        portion_description: `1 serving (${recipe.servings} servings total)`,
        quantity: 1,
        unit: 'serving',
        calories: recipe.perServing.calories,
        protein_g: recipe.perServing.protein_g,
        carbs_g: recipe.perServing.carbs_g,
        fat_g: recipe.perServing.fat_g,
        fiber_g: 0,
        sugar_g: 0,
        sodium_mg: 0,
        saturated_fat_g: 0,
        cholesterol_mg: 0,
        food_database_id: null,
        barcode: null,
        source: 'recipe',
      });
      sessionState.setJustLoggedFood(recipe.name);
      toast.show(`Added: ${recipe.name}`, 'success');
      setTimeout(() => router.back(), 800);
    } catch {
      toast.show('Could not add recipe. Try again.', 'error');
    }
  };

  const recipeRows: RichRow[] = myRecipes.map((recipe) => ({
    id: recipe.id,
    name: recipe.name,
    hint: 'Per serving',
    calories: recipe.perServing.calories,
    protein_g: Number(recipe.perServing.protein_g),
    carbs_g: Number(recipe.perServing.carbs_g),
    fat_g: Number(recipe.perServing.fat_g),
    onAdd: () => void handleLogRecipe(recipe),
  }));

  const isSearching = searchQuery.trim().length > 0;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: t.bg }}
      edges={['top', 'left', 'right']}
    >
      <Header />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <SearchBar
          value={searchQuery}
          onChangeText={handleSearchChange}
          recognizing={recognizing}
          micPulse={micPulse}
          onMicPress={handleVoiceInput}
        />
        {recognizing && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.sm,
              paddingHorizontal: space.lg,
              paddingTop: space.xs,
            }}
          >
            <Animated.View style={{ transform: [{ scale: micPulse }] }}>
              <Ionicons name="mic" size={14} color={t.danger} />
            </Animated.View>
            <Text style={[typo.caption1, { color: t.danger }]}>
              Listening... tap mic to stop
            </Text>
          </View>
        )}
        <QuickActions />

        {isSearching ? (
          searching ? (
            <View
              style={{
                alignItems: 'center',
                paddingVertical: space.xxxl,
              }}
            >
              <ActivityIndicator color={t.primary} />
            </View>
          ) : searchResults.length === 0 ? (
            <EmptySearchState query={searchQuery.trim()} />
          ) : (
            <SearchResultsList
              results={searchResults}
              onSelect={handleSelectFood}
            />
          )
        ) : loading ? (
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
            <Section
              label="Recents"
              rows={recentRows}
              emptyState={<RecentsEmptyState />}
            />
            <Section
              label="My recipes"
              rows={recipeRows}
              emptyState={<RecipesEmptyState />}
            />
          </>
        )}

        {/* Create custom food */}
        <Pressable
          onPress={() => router.push('/custom-food')}
          style={({ pressed }) => ({
            marginHorizontal: space.lg,
            marginTop: space.xl,
            backgroundColor: t.surface,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: t.hairline,
            paddingHorizontal: space.lg,
            paddingVertical: space.md,
            flexDirection: 'row',
            alignItems: 'center',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Ionicons
            name="add-circle-outline"
            size={20}
            color={t.primary}
          />
          <Text
            style={[
              typo.subhead,
              { color: t.primary, flex: 1, marginLeft: space.sm },
            ]}
          >
            Create custom food
          </Text>
          <Ionicons name="chevron-forward" size={16} color={t.textTer} />
        </Pressable>

        {/* Build a recipe */}
        <Pressable
          onPress={() => router.push('/recipe-builder')}
          style={({ pressed }) => ({
            marginHorizontal: space.lg,
            marginTop: space.sm,
            backgroundColor: t.surface,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: t.hairline,
            paddingHorizontal: space.lg,
            paddingVertical: space.md,
            flexDirection: 'row',
            alignItems: 'center',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Ionicons name="book-outline" size={20} color={t.primary} />
          <Text
            style={[
              typo.subhead,
              { color: t.primary, flex: 1, marginLeft: space.sm },
            ]}
          >
            Build a recipe
          </Text>
          <Ionicons name="chevron-forward" size={16} color={t.textTer} />
        </Pressable>
      </ScrollView>

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
