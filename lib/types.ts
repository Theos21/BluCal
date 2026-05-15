// Database-shaped types. Property names mirror the snake_case columns
// defined in supabase/schema.sql so rows from the Supabase client can be
// used directly without any field renaming.

export type BiologicalSex = 'male' | 'female' | 'other';
export type WeightUnit = 'lbs' | 'kg';
export type Goal = 'lose_fat' | 'build_muscle' | 'maintain' | 'performance';
export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'very_active'
  | 'athlete';
export type FoodSource =
  | 'search'
  | 'barcode'
  | 'bluai'
  | 'voice'
  | 'manual'
  | 'recipe';
export type PartnershipStatus = 'pending' | 'accepted' | 'declined';
export type Pace = 'slow' | 'moderate' | 'aggressive';

export interface Profile {
  id: string;
  name: string | null;
  email: string | null;
  biological_sex: BiologicalSex | null;
  birthday: string | null;
  height_cm: number | null;
  weight_unit: WeightUnit;
  is_metric: boolean;
  goal: Goal | null;
  goal_weight_kg: number | null;
  activity_level: ActivityLevel | null;
  dietary_preferences: string[];
  pace: Pace;
  apple_health_connected: boolean;
  show_school?: boolean;
  show_community_foods?: boolean;
  notif_log_reminder?: boolean;
  notif_log_reminder_hour?: number;
  notif_weigh_in?: boolean;
  notif_weigh_in_hour?: number;
  notif_weekly_summary?: boolean;
  notif_streak_alerts?: boolean;
  created_at: string;
  updated_at: string;
}

export interface MacroTarget {
  id: string;
  user_id: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  is_custom: boolean;
  net_carbs: boolean;
  effective_date: string;
  created_at: string;
}

export interface FoodEntry {
  id: string;
  user_id: string;
  logged_at: string;
  name: string;
  portion_description: string | null;
  quantity: number;
  unit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  saturated_fat_g: number | null;
  cholesterol_mg: number | null;
  food_database_id: string | null;
  barcode: string | null;
  source: FoodSource;
  created_at: string;
}

export interface WeightEntry {
  id: string;
  user_id: string;
  logged_at: string;
  weight_kg: number;
  note: string | null;
  created_at: string;
}

export interface WaterEntry {
  id: string;
  user_id: string;
  logged_at: string;
  amount_ml: number;
  created_at: string;
}

export interface Measurement {
  id: string;
  user_id: string;
  logged_at: string;
  measurement_type: string;
  value_cm: number;
  created_at: string;
}

export interface FeelingEntry {
  id: string;
  user_id: string;
  logged_at: string;
  hunger: number | null;
  energy: number | null;
  mood: number | null;
  created_at: string;
}

export interface CustomFood {
  id: string;
  user_id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  serving_size: number;
  serving_unit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  saturated_fat_g: number | null;
  cholesterol_mg: number | null;
  is_public: boolean;
  created_at: string;
}

export interface Recipe {
  id: string;
  user_id: string;
  name: string;
  servings: number;
  total_yield: number | null;
  yield_unit: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  custom_food_id: string | null;
  food_database_id: string | null;
  sort_order: number;
}

export interface PlannedMeal {
  id: string;
  user_id: string;
  planned_for: string;
  planned_time: string | null;
  name: string;
  portion_description: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  recipe_id: string | null;
  is_logged: boolean;
  created_at: string;
}

export interface Partnership {
  id: string;
  requester_id: string;
  partner_id: string;
  status: PartnershipStatus;
  created_at: string;
}

export interface PushToken {
  id: string;
  user_id: string;
  token: string;
  platform: string;
  created_at: string;
  updated_at: string;
}

export interface ProgressPhoto {
  id: string;
  user_id: string;
  storage_path: string;
  taken_at: string;
  note: string | null;
  created_at: string;
}
