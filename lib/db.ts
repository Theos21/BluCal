import { supabase } from './supabase';
// HealthKit mirroring disabled until native linking is fixed via Xcode.
// import { writeNutrition, writeWeight } from './appleHealth';
import type {
  CustomFood,
  FeelingEntry,
  FoodEntry,
  MacroTarget,
  Measurement,
  PlannedMeal,
  Profile,
  ProgressPhoto,
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

  // TODO: Re-enable HealthKit mirroring once native linking is verified.
  // writeNutrition({
  //   calories: entry.calories,
  //   protein_g: Number(entry.protein_g),
  //   carbs_g: Number(entry.carbs_g),
  //   fat_g: Number(entry.fat_g),
  //   logged_at: entry.logged_at,
  // }).catch(console.error);

  return data as FoodEntry;
};

export const deleteFoodEntry = async (id: string): Promise<void> => {
  const { error } = await supabase.from('food_entries').delete().eq('id', id);
  if (error) throw error;
};

// Number of consecutive days, counting back from today, on which the user
// has logged at least one food entry. Returns 0 if today has no entries.
const localDateKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const getStreak = async (userId: string): Promise<number> => {
  const { data, error } = await supabase
    .from('food_entries')
    .select('logged_at')
    .eq('user_id', userId)
    .order('logged_at', { ascending: false });

  if (error) throw error;
  if (!data || data.length === 0) return 0;

  const loggedDates = new Set(
    data.map((e) => localDateKey(new Date(e.logged_at))),
  );

  const checkDate = new Date();
  if (!loggedDates.has(localDateKey(checkDate))) return 0;

  let streak = 0;
  while (loggedDates.has(localDateKey(checkDate))) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
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

  // TODO: Re-enable HealthKit mirroring once native linking is verified.
  // writeWeight(entry.weight_kg, entry.logged_at).catch(console.error);

  return data as WeightEntry;
};

export const deleteWeightEntry = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('weight_entries')
    .delete()
    .eq('id', id);
  if (error) throw error;
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

export const resetWaterForDate = async (
  userId: string,
  date: Date,
): Promise<void> => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  const { error } = await supabase
    .from('water_entries')
    .delete()
    .eq('user_id', userId)
    .gte('logged_at', start.toISOString())
    .lte('logged_at', end.toISOString());
  if (error) throw error;
};

// Replace today's water log with a single entry of `amountOz`. Pass 0 to
// clear without re-adding.
export const setWaterExact = async (
  userId: string,
  amountOz: number,
  date: Date,
): Promise<void> => {
  await resetWaterForDate(userId, date);
  if (amountOz > 0) {
    await addWaterEntry(userId, amountOz);
  }
};

// Momentum score (0-100) from three equally-weighted 7-day components:
//   1. Logging consistency (0-33): days where any food was logged
//   2. Macro adherence    (0-33): average daily closeness to P/C/F targets
//   3. Weight trend       (0-34): is direction-of-change aligned with goal?
// Returns 0 if no food has been logged in the last 7 days.
export const calculateMomentumScore = async (
  userId: string,
  goal: string = 'maintain',
): Promise<number> => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [foodEntries, weightEntries, macroTarget] = await Promise.all([
    getFoodEntriesForDateRange(userId, sevenDaysAgo, new Date()),
    getWeightEntries(userId, 14),
    getCurrentMacroTarget(userId),
  ]);

  const targetP = macroTarget?.protein_g ?? 160;
  const targetC = macroTarget?.carbs_g ?? 220;
  const targetF = macroTarget?.fat_g ?? 65;

  const dailyCalMap: Record<string, number> = {};
  foodEntries.forEach((e) => {
    const day = localDateKey(new Date(e.logged_at));
    dailyCalMap[day] = (dailyCalMap[day] ?? 0) + e.calories;
  });
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return localDateKey(d);
  });
  // Any food logged that day counts. Strict 80%-of-target gating was too
  // punitive and parked the score at zero for users still building the habit.
  const daysWithLogging = last7Days.filter(
    (d) => (dailyCalMap[d] ?? 0) > 0,
  ).length;
  const consistencyScore = Math.round((daysWithLogging / 7) * 33);

  const loggingDays = Object.keys(dailyCalMap).length;
  if (loggingDays === 0) return 0;

  const dailyMacroMap: Record<string, { p: number; c: number; f: number }> = {};
  foodEntries.forEach((e) => {
    const day = localDateKey(new Date(e.logged_at));
    if (!dailyMacroMap[day]) dailyMacroMap[day] = { p: 0, c: 0, f: 0 };
    dailyMacroMap[day].p += Number(e.protein_g);
    dailyMacroMap[day].c += Number(e.carbs_g);
    dailyMacroMap[day].f += Number(e.fat_g);
  });
  const macroScores = Object.values(dailyMacroMap).map((day) => {
    const pScore =
      targetP > 0 ? Math.max(0, 1 - Math.abs(day.p - targetP) / targetP) : 0;
    const cScore =
      targetC > 0 ? Math.max(0, 1 - Math.abs(day.c - targetC) / targetC) : 0;
    const fScore =
      targetF > 0 ? Math.max(0, 1 - Math.abs(day.f - targetF) / targetF) : 0;
    return (pScore + cScore + fScore) / 3;
  });
  const avgMacroScore =
    macroScores.reduce((s, v) => s + v, 0) / macroScores.length;
  const adherenceScore = Math.round(avgMacroScore * 33);

  let alignmentScore = 17;
  if (weightEntries.length >= 4) {
    // getWeightEntries returns ascending (oldest first). The first half is
    // the older window, the second half is the more recent window. The
    // earlier code had these names swapped, inverting trend direction.
    const half = Math.floor(weightEntries.length / 2);
    const older = weightEntries.slice(0, half);
    const recent = weightEntries.slice(half);
    const olderAvg =
      older.reduce((s, e) => s + Number(e.weight_kg), 0) / older.length;
    const recentAvg =
      recent.reduce((s, e) => s + Number(e.weight_kg), 0) / recent.length;
    const trend = recentAvg - olderAvg;

    if (goal === 'lose_fat' && trend < -0.1) alignmentScore = 34;
    else if (goal === 'lose_fat' && trend > 0.3) alignmentScore = 0;
    else if (goal === 'build_muscle' && trend > 0.1) alignmentScore = 34;
    else if (goal === 'build_muscle' && trend < -0.3) alignmentScore = 0;
    else if (goal === 'maintain' && Math.abs(trend) < 0.3)
      alignmentScore = 34;
    else alignmentScore = 17;
  }

  return Math.min(100, consistencyScore + adherenceScore + alignmentScore);
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

// Insert-or-update. Use for flows (e.g., onboarding) where the row may not
// exist yet because the new-user trigger hasn't completed, or could be
// missing after manual cleanup. Plain `updateProfile` requires the row to
// exist and silently returns no rows otherwise.
export const upsertProfile = async (
  userId: string,
  updates: Partial<Profile>,
): Promise<Profile> => {
  // First try a minimal update to test RLS
  const { data: testData, error: testError } = await supabase
    .from('profiles')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();

  console.log(
    'Minimal update test:',
    JSON.stringify({ testData, testError }),
  );

  // Now try the full upsert
  const payload = {
    id: userId,
    ...updates,
    updated_at: new Date().toISOString(),
  };

  console.log('Full upsert payload:', JSON.stringify(payload));

  const { data, error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();

  console.log('Full upsert result:', JSON.stringify({ data, error }));

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

// Public community foods matching a search query, newest first. Backed by the
// "public custom foods are viewable by all" RLS policy on custom_foods.
export const getCommunityFoods = async (
  query: string,
): Promise<CustomFood[]> => {
  const { data, error } = await supabase
    .from('custom_foods')
    .select('*')
    .eq('is_public', true)
    .ilike('name', `%${query}%`)
    .order('created_at', { ascending: false })
    .limit(20);
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

export const deleteCustomFood = async (id: string): Promise<void> => {
  const { error } = await supabase.from('custom_foods').delete().eq('id', id);
  if (error) throw error;
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

export interface RecipeWithMacros extends Recipe {
  perServing: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  };
}

// Returns each recipe along with per-serving macros, computed by summing
// every ingredient's totals and dividing by `servings`. One ingredients
// fetch is issued — not per-recipe — so this stays cheap on large libraries.
export const getRecipesWithMacros = async (
  userId: string,
): Promise<RecipeWithMacros[]> => {
  const recipes = await getRecipes(userId);
  if (recipes.length === 0) return [];
  const ids = recipes.map((r) => r.id);
  const { data, error } = await supabase
    .from('recipe_ingredients')
    .select('recipe_id, calories, protein_g, carbs_g, fat_g')
    .in('recipe_id', ids);
  if (error) throw error;
  const byRecipe: Record<string, RecipeWithMacros['perServing']> = {};
  for (const ing of (data ?? []) as {
    recipe_id: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  }[]) {
    const acc = byRecipe[ing.recipe_id] ?? {
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
    };
    acc.calories += Number(ing.calories) || 0;
    acc.protein_g += Number(ing.protein_g) || 0;
    acc.carbs_g += Number(ing.carbs_g) || 0;
    acc.fat_g += Number(ing.fat_g) || 0;
    byRecipe[ing.recipe_id] = acc;
  }
  return recipes.map((r) => {
    const totals = byRecipe[r.id] ?? {
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
    };
    const s = r.servings > 0 ? r.servings : 1;
    return {
      ...r,
      perServing: {
        calories: Math.round(totals.calories / s),
        protein_g: Math.round(totals.protein_g / s),
        carbs_g: Math.round(totals.carbs_g / s),
        fat_g: Math.round(totals.fat_g / s),
      },
    };
  });
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

export const unlogPlannedMeal = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('planned_meals')
    .update({ is_logged: false })
    .eq('id', id);
  if (error) throw error;
};

// ── Progress photos ──────────────────────────────────────────────────────────
// The `progress-photos` storage bucket is private (RLS-gated to the owner).
// Reads require signed URLs, which we batch-mint here so the photo grid can
// render with simple <Image source={{ uri: photo.signedUrl }} /> calls.
export interface ProgressPhotoWithUrl extends ProgressPhoto {
  signedUrl: string;
}

const SIGNED_URL_TTL_SECONDS = 3600;

export const getProgressPhotos = async (
  userId: string,
): Promise<ProgressPhotoWithUrl[]> => {
  const { data, error } = await supabase
    .from('progress_photos')
    .select('*')
    .eq('user_id', userId)
    .order('taken_at', { ascending: false });
  if (error) throw error;
  const photos = (data ?? []) as ProgressPhoto[];
  if (photos.length === 0) return [];
  const { data: signed, error: signErr } = await supabase.storage
    .from('progress-photos')
    .createSignedUrls(
      photos.map((p) => p.storage_path),
      SIGNED_URL_TTL_SECONDS,
    );
  if (signErr) throw signErr;
  return photos.map((p, i) => ({
    ...p,
    signedUrl: signed?.[i]?.signedUrl ?? '',
  }));
};

export const addProgressPhoto = async (
  userId: string,
  uri: string,
  takenAt: string,
): Promise<ProgressPhoto> => {
  // RN's fetch().blob() works with supabase-js v2 for image uploads; the
  // storage policy expects the path's first folder segment to equal the
  // user id (see storage.foldername policy in schema.sql).
  const response = await fetch(uri);
  const blob = await response.blob();
  const path = `${userId}/${Date.now()}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from('progress-photos')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from('progress_photos')
    .insert({ user_id: userId, storage_path: path, taken_at: takenAt })
    .select()
    .single();
  if (error) throw error;
  return data as ProgressPhoto;
};

export const deleteProgressPhoto = async (
  photo: ProgressPhoto,
): Promise<void> => {
  // Delete the row first so a transient storage-delete failure can't leave
  // a tile pointing at a missing object (which would surface as a broken
  // image in the UI). Orphan storage objects are cheaper than orphan rows.
  const { error } = await supabase
    .from('progress_photos')
    .delete()
    .eq('id', photo.id);
  if (error) throw error;
  await supabase.storage.from('progress-photos').remove([photo.storage_path]);
};
