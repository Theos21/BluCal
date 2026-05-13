import { supabase } from './supabase';
import { writeNutrition, writeWeight } from './appleHealth';
import type {
  CustomFood,
  FeelingEntry,
  FoodEntry,
  MacroTarget,
  Measurement,
  PlannedMeal,
  Profile,
  Recipe,
  RecipeIngredient,
  WeightEntry,
} from './types';

// Convert a Date to the start of its local day, expressed as an ISO string
// suitable for comparing against `timestamptz` columns.
function startOfLocalDayISO(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfNextLocalDayISO(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
}

// Format a Date as 'YYYY-MM-DD' for `date` columns, using the local calendar
// day so plans stay aligned with what the user sees on screen.
function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ── Food entries ─────────────────────────────────────────────────────────────
export const getFoodEntriesForDate = async (
  userId: string,
  date: Date,
): Promise<FoodEntry[]> => {
  const { data, error } = await supabase
    .from('food_entries')
    .select('*')
    .eq('user_id', userId)
    .gte('logged_at', startOfLocalDayISO(date))
    .lt('logged_at', startOfNextLocalDayISO(date))
    .order('logged_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as FoodEntry[];
};

export const addFoodEntry = async (
  entry: Omit<FoodEntry, 'id' | 'created_at'>,
): Promise<FoodEntry> => {
  const { data, error } = await supabase
    .from('food_entries')
    .insert(entry)
    .select()
    .single();
  if (error) throw error;

  // Mirror to Apple Health in the background — never block on it or throw.
  writeNutrition({
    calories: entry.calories,
    protein_g: Number(entry.protein_g),
    carbs_g: Number(entry.carbs_g),
    fat_g: Number(entry.fat_g),
    logged_at: entry.logged_at,
  }).catch(console.error);

  return data as FoodEntry;
};

export const deleteFoodEntry = async (id: string): Promise<void> => {
  const { error } = await supabase.from('food_entries').delete().eq('id', id);
  if (error) throw error;
};

// Number of consecutive days, counting back from today, on which the user
// has logged at least one food entry. Returns 0 if today has no entries.
export const getStreak = async (userId: string): Promise<number> => {
  const { data, error } = await supabase
    .from('food_entries')
    .select('logged_at')
    .eq('user_id', userId)
    .order('logged_at', { ascending: false });

  if (error) throw error;
  if (!data || data.length === 0) return 0;

  const loggedDates = new Set(
    data.map((e) => new Date(e.logged_at).toLocaleDateString('en-CA')),
  );

  let streak = 0;
  const cursor = new Date();
  while (true) {
    const dateStr = cursor.toLocaleDateString('en-CA');
    if (loggedDates.has(dateStr)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
};

export const updateFoodEntry = async (
  id: string,
  updates: Partial<FoodEntry>,
): Promise<FoodEntry> => {
  const { data, error } = await supabase
    .from('food_entries')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as FoodEntry;
};

// Last 10 distinct foods (by name) the user has logged. Used to populate the
// "Recents" picker on the Log Food screen.
export const getRecentFoods = async (
  userId: string,
): Promise<FoodEntry[]> => {
  const { data, error } = await supabase
    .from('food_entries')
    .select('*')
    .eq('user_id', userId)
    .order('logged_at', { ascending: false })
    .limit(20);

  if (error) throw error;

  const seen = new Set<string>();
  const unique: FoodEntry[] = [];
  for (const entry of (data ?? []) as FoodEntry[]) {
    if (!seen.has(entry.name)) {
      seen.add(entry.name);
      unique.push(entry);
    }
  }
  return unique.slice(0, 10);
};

export const getFoodEntriesForDateRange = async (
  userId: string,
  startDate: Date,
  endDate: Date,
): Promise<FoodEntry[]> => {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from('food_entries')
    .select('*')
    .eq('user_id', userId)
    .gte('logged_at', start.toISOString())
    .lte('logged_at', end.toISOString())
    .order('logged_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as FoodEntry[];
};

// ── Weight entries ───────────────────────────────────────────────────────────
export const getWeightEntries = async (
  userId: string,
  days: number,
): Promise<WeightEntry[]> => {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - days);
  const { data, error } = await supabase
    .from('weight_entries')
    .select('*')
    .eq('user_id', userId)
    .gte('logged_at', since.toISOString())
    .order('logged_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as WeightEntry[];
};

export const addWeightEntry = async (
  entry: Omit<WeightEntry, 'id' | 'created_at'>,
): Promise<WeightEntry> => {
  const { data, error } = await supabase
    .from('weight_entries')
    .insert(entry)
    .select()
    .single();
  if (error) throw error;

  writeWeight(entry.weight_kg, entry.logged_at).catch(console.error);

  return data as WeightEntry;
};

// ── Water entries ────────────────────────────────────────────────────────────
// Total water logged for the given local day, returned in fluid ounces
// (rounded). Storage is in millilitres so the conversion factor 29.5735
// ml/oz applies on both read and write.
export const getWaterForDate = async (
  userId: string,
  date: Date,
): Promise<number> => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from('water_entries')
    .select('amount_ml')
    .eq('user_id', userId)
    .gte('logged_at', start.toISOString())
    .lte('logged_at', end.toISOString());

  if (error) throw error;
  const totalMl = data?.reduce((s, e) => s + e.amount_ml, 0) ?? 0;
  return Math.round(totalMl / 29.5735);
};

export const addWaterEntry = async (
  userId: string,
  amountOz: number,
): Promise<void> => {
  const amountMl = Math.round(amountOz * 29.5735);
  const { error } = await supabase.from('water_entries').insert({
    user_id: userId,
    amount_ml: amountMl,
    logged_at: new Date().toISOString(),
  });
  if (error) throw error;
};

// ── Macro targets ────────────────────────────────────────────────────────────
export const getCurrentMacroTarget = async (
  userId: string,
): Promise<MacroTarget | null> => {
  const { data, error } = await supabase
    .from('macro_targets')
    .select('*')
    .eq('user_id', userId)
    .order('effective_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as MacroTarget | null) ?? null;
};

export const setMacroTarget = async (
  target: Omit<MacroTarget, 'id' | 'created_at'>,
): Promise<MacroTarget> => {
  const { data, error } = await supabase
    .from('macro_targets')
    .insert(target)
    .select()
    .single();
  if (error) throw error;
  return data as MacroTarget;
};

// ── Profile ──────────────────────────────────────────────────────────────────
export const getProfile = async (userId: string): Promise<Profile | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as Profile | null) ?? null;
};

export const updateProfile = async (
  userId: string,
  updates: Partial<Profile>,
): Promise<Profile> => {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data as Profile;
};

// ── Feeling entries ──────────────────────────────────────────────────────────
export const getFeelingEntriesForDate = async (
  userId: string,
  date: Date,
): Promise<FeelingEntry[]> => {
  const { data, error } = await supabase
    .from('feeling_entries')
    .select('*')
    .eq('user_id', userId)
    .gte('logged_at', startOfLocalDayISO(date))
    .lt('logged_at', startOfNextLocalDayISO(date))
    .order('logged_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as FeelingEntry[];
};

export const addFeelingEntry = async (
  entry: Omit<FeelingEntry, 'id' | 'created_at'>,
): Promise<FeelingEntry> => {
  const { data, error } = await supabase
    .from('feeling_entries')
    .insert(entry)
    .select()
    .single();
  if (error) throw error;
  return data as FeelingEntry;
};

export const getFeelingEntriesForDateRange = async (
  userId: string,
  startDate: Date,
  endDate: Date,
): Promise<FeelingEntry[]> => {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from('feeling_entries')
    .select('*')
    .eq('user_id', userId)
    .gte('logged_at', start.toISOString())
    .lte('logged_at', end.toISOString())
    .order('logged_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as FeelingEntry[];
};

// ── Measurements ─────────────────────────────────────────────────────────────
export const getMeasurements = async (
  userId: string,
): Promise<Measurement[]> => {
  const { data, error } = await supabase
    .from('measurements')
    .select('*')
    .eq('user_id', userId)
    .order('logged_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Measurement[];
};

export const addMeasurement = async (
  entry: Omit<Measurement, 'id' | 'created_at'>,
): Promise<Measurement> => {
  const { data, error } = await supabase
    .from('measurements')
    .insert(entry)
    .select()
    .single();
  if (error) throw error;
  return data as Measurement;
};

// ── Custom foods ─────────────────────────────────────────────────────────────
export const getCustomFoods = async (
  userId: string,
): Promise<CustomFood[]> => {
  const { data, error } = await supabase
    .from('custom_foods')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as CustomFood[];
};

export const addCustomFood = async (
  food: Omit<CustomFood, 'id' | 'created_at'>,
): Promise<CustomFood> => {
  const { data, error } = await supabase
    .from('custom_foods')
    .insert(food)
    .select()
    .single();
  if (error) throw error;
  return data as CustomFood;
};

// ── Recipes ──────────────────────────────────────────────────────────────────
export const getRecipes = async (userId: string): Promise<Recipe[]> => {
  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Recipe[];
};

export const addRecipe = async (
  recipe: Omit<Recipe, 'id' | 'created_at' | 'updated_at'>,
  ingredients: Omit<RecipeIngredient, 'id'>[],
): Promise<Recipe> => {
  const { data: created, error: recipeError } = await supabase
    .from('recipes')
    .insert(recipe)
    .select()
    .single();
  if (recipeError) throw recipeError;
  const newRecipe = created as Recipe;

  if (ingredients.length > 0) {
    const rows = ingredients.map((ing) => ({
      ...ing,
      recipe_id: newRecipe.id,
    }));
    const { error: ingredientsError } = await supabase
      .from('recipe_ingredients')
      .insert(rows);
    if (ingredientsError) {
      // Best-effort rollback: delete the recipe so we don't leave an
      // orphan with no ingredients.
      await supabase.from('recipes').delete().eq('id', newRecipe.id);
      throw ingredientsError;
    }
  }

  return newRecipe;
};

export const deleteRecipe = async (id: string): Promise<void> => {
  const { error } = await supabase.from('recipes').delete().eq('id', id);
  if (error) throw error;
};

// ── Planned meals ────────────────────────────────────────────────────────────
export const getPlannedMealsForWeek = async (
  userId: string,
  weekStart: Date,
): Promise<PlannedMeal[]> => {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const { data, error } = await supabase
    .from('planned_meals')
    .select('*')
    .eq('user_id', userId)
    .gte('planned_for', toDateString(weekStart))
    .lt('planned_for', toDateString(weekEnd))
    .order('planned_for', { ascending: true })
    .order('planned_time', { ascending: true });
  if (error) throw error;
  return (data ?? []) as PlannedMeal[];
};

export const addPlannedMeal = async (
  meal: Omit<PlannedMeal, 'id' | 'created_at'>,
): Promise<PlannedMeal> => {
  const { data, error } = await supabase
    .from('planned_meals')
    .insert(meal)
    .select()
    .single();
  if (error) throw error;
  return data as PlannedMeal;
};

export const deletePlannedMeal = async (id: string): Promise<void> => {
  const { error } = await supabase.from('planned_meals').delete().eq('id', id);
  if (error) throw error;
};
