import { supabase } from './supabase';

export interface ImportedIngredient {
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface ImportedRecipe {
  name: string;
  servings: number;
  ingredients: ImportedIngredient[];
}

export const importRecipeFromUrl = async (
  url: string,
): Promise<ImportedRecipe> => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const { data, error } = await supabase.functions.invoke('recipe-import', {
    body: { url },
  });

  if (error)
    throw new Error('Could not import recipe. Check the URL and try again.');
  if (data?.error) throw new Error(data.error);
  if (!data?.ingredients?.length)
    throw new Error('No ingredients found in recipe.');

  return data as ImportedRecipe;
};
