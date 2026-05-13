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
  'energy-kcal'?: number;
  proteins_100g?: number;
  carbohydrates_100g?: number;
  fat_100g?: number;
  fiber_100g?: number;
  sugars_100g?: number;
  sodium_100g?: number;
};

type OffProduct = {
  id?: string;
  code?: string;
  product_name?: string;
  brands?: string;
  nutriments?: OffNutriments;
  serving_size?: string;
};

const num = (v: number | undefined): number => (typeof v === 'number' ? v : 0);
const round1 = (v: number): number => Math.round(v * 10) / 10;

function toResult(p: OffProduct, fallbackId: string): FoodSearchResult {
  const n: OffNutriments = p.nutriments ?? {};
  const calories = Math.round(num(n['energy-kcal_100g']) || num(n['energy-kcal']));
  return {
    id: p.id ?? p.code ?? fallbackId,
    name: p.product_name ?? 'Unknown food',
    brand: p.brands ?? null,
    calories,
    protein_g: round1(num(n.proteins_100g)),
    carbs_g: round1(num(n.carbohydrates_100g)),
    fat_g: round1(num(n.fat_100g)),
    fiber_g: round1(num(n.fiber_100g)),
    sugar_g: round1(num(n.sugars_100g)),
    sodium_mg: Math.round(num(n.sodium_100g) * 1000),
    serving_size: 100,
    serving_unit: 'g',
    barcode: p.code ?? null,
  };
}

export const searchFoods = async (
  query: string,
): Promise<FoodSearchResult[]> => {
  if (!query.trim()) return [];

  const url = `${OFF_API}/cgi/search.pl?search_terms=${encodeURIComponent(
    query,
  )}&search_simple=1&action=process&json=1&page_size=20&fields=id,product_name,brands,nutriments,serving_size,code`;

  const res = await fetch(url);
  if (!res.ok) throw new Error('Food search failed');
  const json = (await res.json()) as { products?: OffProduct[] };

  return (json.products ?? [])
    .filter((p) => !!p.product_name && !!p.nutriments)
    .map((p, i) => toResult(p, `r-${i}-${Math.random().toString(36).slice(2)}`))
    .filter((r) => r.calories > 0 || r.protein_g > 0);
};

export const lookupBarcode = async (
  barcode: string,
): Promise<FoodSearchResult | null> => {
  const url = `${OFF_API}/api/v0/product/${barcode}.json?fields=product_name,brands,nutriments,serving_size,code`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = (await res.json()) as { status?: number; product?: OffProduct };
  if (json.status !== 1 || !json.product) return null;
  return {
    ...toResult(json.product, barcode),
    id: barcode,
    barcode,
  };
};
