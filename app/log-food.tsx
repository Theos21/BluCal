import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { radius, space, type as typo, useTheme } from '../lib/theme';
import Toast from '../components/Toast';
import { useToast } from '../lib/useToast';
import { useAuth } from '../lib/AuthContext';
import { addFoodEntry, getRecentFoods, getRecipes } from '../lib/db';
import { searchFoods, type FoodSearchResult } from '../lib/foodSearch';
import { sessionState } from '../lib/sessionState';
import type { FoodEntry, Recipe } from '../lib/types';

type FoodRow = {
  id: string;
  name: string;
  detail: string;
  onAdd: () => void;
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
}: {
  value: string;
  onChangeText: (v: string) => void;
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
      <Pressable hitSlop={6}>
        <Ionicons name="mic-outline" size={20} color={t.textSec} />
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

function FoodRowItem({
  row,
  showDivider,
}: {
  row: FoodRow;
  showDivider: boolean;
}) {
  const t = useTheme();
  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 12,
          gap: 12,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[typo.subhead, { color: t.text }]} numberOfLines={1}>
            {row.name}
          </Text>
          <Text
            style={[typo.caption1, { color: t.textTer, marginTop: 2 }]}
            numberOfLines={1}
          >
            {row.detail}
          </Text>
        </View>
        <Pressable
          onPress={row.onAdd}
          hitSlop={6}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Ionicons name="add-circle-outline" size={26} color={t.primary} />
        </Pressable>
      </View>
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
  rows: FoodRow[];
  emptyState?: React.ReactNode;
}) {
  return (
    <View style={{ paddingHorizontal: space.lg, marginTop: space.xl }}>
      <SectionLabel label={label} />
      <View style={{ marginTop: space.xs }}>
        {rows.length === 0 && emptyState
          ? emptyState
          : rows.map((row, i) => (
              <FoodRowItem
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

function SearchResultItem({
  result,
  onSelect,
}: {
  result: FoodSearchResult;
  onSelect: () => void;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        gap: 12,
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[typo.subhead, { color: t.text }]} numberOfLines={1}>
          {result.name}
        </Text>
        {result.brand && (
          <Text
            style={[typo.caption1, { color: t.textSec, marginTop: 2 }]}
            numberOfLines={1}
          >
            {result.brand}
          </Text>
        )}
        <Text
          style={[typo.caption1, { color: t.textTer, marginTop: 2 }]}
          numberOfLines={1}
        >
          {`${result.calories} kcal · ${result.protein_g}p · ${result.carbs_g}c · ${result.fat_g}f`}
        </Text>
      </View>
      <Pressable
        onPress={onSelect}
        hitSlop={6}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      >
        <Ionicons name="add-circle-outline" size={26} color={t.primary} />
      </Pressable>
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
  const t = useTheme();
  return (
    <View style={{ paddingHorizontal: space.lg, marginTop: space.xl }}>
      <SectionLabel label="Search results" />
      <View style={{ marginTop: space.xs }}>
        {results.map((r, i) => (
          <View key={r.id}>
            <SearchResultItem result={r} onSelect={() => onSelect(r)} />
            {i < results.length - 1 && (
              <View style={{ height: 0.5, backgroundColor: t.hairline }} />
            )}
          </View>
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
  const [myRecipes, setMyRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    Promise.all([getRecentFoods(user.id), getRecipes(user.id)])
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

  const recentRows: FoodRow[] = recentFoods.map((entry) => ({
    id: entry.id,
    name: entry.name,
    detail: `${entry.calories} kcal · ${Math.round(Number(entry.protein_g))}p · ${Math.round(Number(entry.carbs_g))}c · ${Math.round(Number(entry.fat_g))}f`,
    onAdd: () => void handleReLog(entry),
  }));

  const recipeRows: FoodRow[] = myRecipes.map((recipe) => ({
    id: recipe.id,
    name: recipe.name,
    detail: `${recipe.servings} serving${recipe.servings !== 1 ? 's' : ''}`,
    onAdd: () => toast.show('Coming soon', 'info'),
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
        <SearchBar value={searchQuery} onChangeText={handleSearchChange} />
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
