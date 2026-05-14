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
  barcode: string | null;
}

const OFF_API = 'https://world.openfoodfacts.org';

type OffNutriments = {
  'energy-kcal_100g'?: number;
  'energy-kcal_serving'?: number;
  'energy-kcal'?: number;
  proteins_100g?: number;
  proteins_serving?: number;
  carbohydrates_100g?: number;
  carbohydrates_serving?: number;
  fat_100g?: number;
  fat_serving?: number;
  fiber_100g?: number;
  fiber_serving?: number;
  sugars_100g?: number;
  sugars_serving?: number;
  sodium_100g?: number;
  sodium_serving?: number;
};

type OffProduct = {
  id?: string;
  code?: string;
  product_name?: string;
  brands?: string;
  nutriments?: OffNutriments;
  serving_size?: string;
  serving_quantity?: string | number;
  serving_quantity_unit?: string;
  serving_size_unit?: string;
};

const mapProduct = (p: OffProduct, barcode?: string): FoodSearchResult => {
  const n: OffNutriments = p.nutriments ?? {};

  const servingSize = p.serving_quantity ? Number(p.serving_quantity) : 100;
  const servingUnit = p.serving_quantity_unit ?? p.serving_size_unit ?? 'g';

  const scaleFactor = servingSize / 100;

  const calories = Math.round(
    n['energy-kcal_serving'] ??
      n['energy-kcal'] ??
      (n['energy-kcal_100g'] ?? 0) * scaleFactor,
  );

  const protein =
    Math.round(
      (n.proteins_serving ?? (n.proteins_100g ?? 0) * scaleFactor) * 10,
    ) / 10;

  const carbs =
    Math.round(
      (n.carbohydrates_serving ?? (n.carbohydrates_100g ?? 0) * scaleFactor) *
        10,
    ) / 10;

  const fat =
    Math.round((n.fat_serving ?? (n.fat_100g ?? 0) * scaleFactor) * 10) / 10;

  const fiber =
    Math.round((n.fiber_serving ?? (n.fiber_100g ?? 0) * scaleFactor) * 10) /
    10;

  const sugar =
    Math.round(
      (n.sugars_serving ?? (n.sugars_100g ?? 0) * scaleFactor) * 10,
    ) / 10;

  const sodium = Math.round(
    (n.sodium_serving ?? (n.sodium_100g ?? 0) * scaleFactor) * 1000,
  );

  return {
    id: barcode ?? p.id ?? p.code ?? Math.random().toString(),
    name: p.product_name ?? 'Unknown food',
    brand: p.brands ?? null,
    calories,
    protein_g: protein,
    carbs_g: carbs,
    fat_g: fat,
    fiber_g: fiber,
    sugar_g: sugar,
    sodium_mg: sodium,
    serving_size: servingSize,
    serving_unit: servingUnit,
    barcode: barcode ?? p.code ?? null,
  };
};

export const searchFoods = async (
  query: string,
): Promise<FoodSearchResult[]> => {
  if (!query.trim()) return [];

  const url = `${OFF_API}/cgi/search.pl?search_terms=${encodeURIComponent(
    query,
  )}&search_simple=1&action=process&json=1&page_size=20&fields=id,product_name,brands,nutriments,serving_size,serving_quantity,serving_quantity_unit,code`;

  const res = await fetch(url);
  if (!res.ok) throw new Error('Food search failed');
  const json = (await res.json()) as { products?: OffProduct[] };

  return (json.products ?? [])
    .filter((p) => !!p.product_name && !!p.nutriments)
    .map((p) => mapProduct(p))
    .filter((r) => r.calories > 0 || r.protein_g > 0);
};

export const lookupBarcode = async (
  barcode: string,
): Promise<FoodSearchResult | null> => {
  const url = `${OFF_API}/api/v0/product/${barcode}.json?fields=product_name,brands,nutriments,serving_size,serving_quantity,serving_quantity_unit,code`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = (await res.json()) as { status?: number; product?: OffProduct };
  if (json.status !== 1 || !json.product) return null;
  return mapProduct(json.product, barcode);
};
