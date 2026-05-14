import { supabase } from './supabase';

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

export const lookupBarcode = async (barcode: string): Promise<FoodSearchResult | null> => {
  const { data, error } = await supabase.functions.invoke('fatsecret', {
    body: { mode: 'barcode', barcode },
  });
  if (error) throw error;
  return data?.result ?? null;
};
