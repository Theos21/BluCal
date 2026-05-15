import { supabase } from './supabase';

export interface FoodServing {
  id: string;
  description: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  metric_amount: number;
  metric_unit: string;
}

export interface FoodSearchResult {
  id: string;
  name: string;
  brand: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  serving_size: number;
  serving_unit: string;
  serving_description: string;
  all_servings: FoodServing[];
  image_url: string | null;
  barcode: string | null;
}

export const searchFoods = async (query: string): Promise<FoodSearchResult[]> => {
  if (!query.trim()) return [];
  const { data, error } = await supabase.functions.invoke('fatsecret', {
    body: { mode: 'search', query: query.trim() },
  });
  if (error) throw error;
  return data?.results ?? [];
};

export const lookupBarcode = async (
  barcode: string,
): Promise<FoodSearchResult | null> => {
  const { data, error } = await supabase.functions.invoke('fatsecret', {
    body: { mode: 'barcode', barcode },
  });
  if (error) throw error;
  return data?.result ?? null;
};

export const autocompleteFoods = async (query: string): Promise<string[]> => {
  if (!query.trim()) return [];
  const { data, error } = await supabase.functions.invoke('fatsecret', {
    body: { mode: 'autocomplete', query: query.trim() },
  });
  if (error) return [];
  return data?.suggestions ?? [];
};
