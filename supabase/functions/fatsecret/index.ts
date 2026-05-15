const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CLIENT_ID = Deno.env.get('FATSECRET_CLIENT_ID') ?? '';
const CLIENT_SECRET = Deno.env.get('FATSECRET_CLIENT_SECRET') ?? '';
const TOKEN_URL = 'https://oauth.fatsecret.com/connect/token';
const API_URL = 'https://platform.fatsecret.com/rest/server.api';

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => {
    console.log('Request timed out after', timeoutMs, 'ms');
    controller.abort();
  }, timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

async function getAccessToken(): Promise<string> {
  console.log('Requesting FatSecret token...');
  console.log('CLIENT_ID set:', CLIENT_ID.length > 0);
  console.log('CLIENT_SECRET set:', CLIENT_SECRET.length > 0);

  const credentials = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
  const res = await fetchWithTimeout(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=basic',
  }, 8000);

  const text = await res.text();
  console.log('Token response:', res.status, text.slice(0, 300));

  if (!res.ok) {
    throw new Error(`FatSecret token failed: ${res.status} ${text}`);
  }

  const data = JSON.parse(text);
  return data.access_token;
}

async function callFatSecret(token: string, params: Record<string, string>): Promise<any> {
  const queryString = new URLSearchParams({ ...params, format: 'json' }).toString();
  console.log('Calling FatSecret method:', params.method);

  const res = await fetchWithTimeout(`${API_URL}?${queryString}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  }, 8000);

  const text = await res.text();
  console.log('FatSecret response:', res.status, text.slice(0, 500));

  if (!res.ok) throw new Error(`FatSecret API error: ${res.status}`);
  return JSON.parse(text);
}

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
    const body = await req.json();
    const { mode, query, barcode } = body;
    console.log('Request mode:', mode, 'query:', query, 'barcode:', barcode);

    const token = await getAccessToken();
    console.log('Token obtained successfully');

    if (mode === 'search') {
      const data = await callFatSecret(token, {
        method: 'foods.search',
        search_expression: query,
        max_results: '20',
        page_number: '0',
      });

      const foods = data.foods?.food ?? [];
      const list = Array.isArray(foods) ? foods : [foods];

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
      const cleanBarcode = (barcode ?? '').trim().replace(/\D/g, '');
      const ean = cleanBarcode.length === 12 ? `0${cleanBarcode}` : cleanBarcode;
      console.log('Barcode lookup:', { original: barcode, clean: cleanBarcode, ean });

      const barcodeData = await callFatSecret(token, {
        method: 'food.find_id_for_barcode',
        barcode: ean,
      });

      const foodId = barcodeData.food_id?.value;
      console.log('Food ID found:', foodId);

      if (!foodId) {
        return new Response(JSON.stringify({ result: null }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const foodData = await callFatSecret(token, {
        method: 'food.get.v4',
        food_id: foodId,
      });

      const result = mapFood(foodData.food, cleanBarcode);
      return new Response(JSON.stringify({ result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Invalid mode. Use search or barcode');
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('Function error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
