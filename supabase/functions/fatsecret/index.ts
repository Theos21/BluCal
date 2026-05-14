const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CLIENT_ID = Deno.env.get('FATSECRET_CLIENT_ID') ?? '';
const CLIENT_SECRET = Deno.env.get('FATSECRET_CLIENT_SECRET') ?? '';
const TOKEN_URL = 'https://oauth.fatsecret.com/connect/token';
const API_URL = 'https://platform.fatsecret.com/rest/server.api';

// Get OAuth 2.0 access token
async function getAccessToken(): Promise<string> {
  const credentials = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=basic',
  });
  if (!res.ok) throw new Error(`Token error: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

// Call FatSecret API
async function callFatSecret(token: string, params: Record<string, string>): Promise<any> {
  const queryString = new URLSearchParams({ ...params, format: 'json' }).toString();
  const res = await fetch(`${API_URL}?${queryString}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`FatSecret API error: ${res.status}`);
  return res.json();
}

// Map FatSecret food to our format
function mapFood(food: any, barcode?: string): any {
  const servings = food.servings?.serving;
  const serving = Array.isArray(servings) ? servings[0] : servings;
  return {
    id: String(food.food_id),
    name: food.food_name ?? 'Unknown',
    brand: food.brand_name ?? null,
    calories: Math.round(Number(serving?.calories ?? 0)),
    protein_g: Math.round(Number(serving?.protein ?? 0) * 10) / 10,
    carbs_g: Math.round(Number(serving?.carbohydrate ?? 0) * 10) / 10,
    fat_g: Math.round(Number(serving?.fat ?? 0) * 10) / 10,
    fiber_g: Math.round(Number(serving?.fiber ?? 0) * 10) / 10,
    sugar_g: Math.round(Number(serving?.sugar ?? 0) * 10) / 10,
    sodium_mg: Math.round(Number(serving?.sodium ?? 0)),
    serving_size: Number(serving?.metric_serving_amount ?? 100),
    serving_unit: serving?.metric_serving_unit ?? 'g',
    serving_description: serving?.serving_description ?? '1 serving',
    barcode: barcode ?? null,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { mode, query, barcode } = await req.json();
    const token = await getAccessToken();

    if (mode === 'search') {
      const data = await callFatSecret(token, {
        method: 'foods.search',
        search_expression: query,
        max_results: '20',
        page_number: '0',
      });

      const foods = data.foods?.food ?? [];
      const list = Array.isArray(foods) ? foods : [foods];

      // Get full details for each food including serving info
      const results = await Promise.all(
        list.slice(0, 10).map(async (f: any) => {
          try {
            const detail = await callFatSecret(token, {
              method: 'food.get.v4',
              food_id: String(f.food_id),
            });
            return mapFood(detail.food);
          } catch {
            return mapFood(f);
          }
        })
      );

      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (mode === 'barcode') {
      // Normalize to 13 digits by padding with leading zero if 12 digits
      const ean = barcode.length === 12 ? `0${barcode}` : barcode;

      const barcodeData = await callFatSecret(token, {
        method: 'food.find_id_for_barcode',
        barcode: ean,
      });

      const foodId = barcodeData.food_id?.value;
      if (!foodId) {
        return new Response(JSON.stringify({ result: null }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const foodData = await callFatSecret(token, {
        method: 'food.get.v4',
        food_id: foodId,
      });

      const result = mapFood(foodData.food, barcode);

      return new Response(JSON.stringify({ result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Invalid mode — use search or barcode');
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
