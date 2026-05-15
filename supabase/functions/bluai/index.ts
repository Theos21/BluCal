// Supabase Edge Function (Deno runtime) — proxies BluAI meal-photo analysis
// to the Anthropic Claude API and enriches portions with FatSecret nutrition.
//
// Deploy with: supabase functions deploy bluai
// Set the API keys with:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   supabase secrets set FATSECRET_CLIENT_ID=...
//   supabase secrets set FATSECRET_CLIENT_SECRET=...
//
// This file is intentionally excluded from the project's `tsc --noEmit`
// (see tsconfig.json `exclude`) because Deno globals and `npm:` specifiers
// are not valid in the React Native TypeScript environment.
import Anthropic from 'npm:@anthropic-ai/sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const MODEL = 'claude-opus-4-7';

const FATSECRET_TOKEN_URL = 'https://oauth.fatsecret.com/connect/token';
const FATSECRET_API_URL = 'https://platform.fatsecret.com/rest/server.api';

const IDENTIFY_PROMPT = `You are a precise food identification and portion estimation AI.

Analyze this meal photo carefully. Look for reference objects that can help calibrate portion sizes:

REFERENCE OBJECTS TO LOOK FOR:
- Human hand: average adult hand width ~85mm, length ~190mm
- Credit card / ID card: 85.6mm x 53.98mm
- US quarter coin: 24.26mm diameter
- US dollar bill: 156mm x 66mm
- Standard fork: ~190mm long
- Standard dinner plate: ~267mm diameter
- Standard bowl: ~152mm diameter
- iPhone (any model): ~147mm x 71mm

If you see ANY of these reference objects in the photo, use them to calibrate your portion size estimates. This dramatically improves accuracy.

For each food item:
1. Identify the food precisely including cooking method
2. Use reference objects OR visual depth cues to estimate portion size in grams
3. Be specific. "grilled chicken thigh skin-on" not just "chicken"
4. Provide fallback calorie/macro estimates per USDA in case the database lookup misses

Return ONLY valid JSON, no other text:
{
  "items": [
    {
      "id": "1",
      "name": "specific food name for database lookup",
      "quantity": "estimated quantity (e.g. '6 oz', '1 cup')",
      "quantity_grams": 170,
      "reference_used": "hand",
      "cal": 280,
      "p": 53,
      "c": 0,
      "f": 6,
      "confidence": "high"
    }
  ],
  "questions": ["specific clarifying questions"],
  "reference_objects_detected": ["hand", "credit card"]
}

USDA calorie references for portion validation:
- Chicken breast cooked: 165 kcal/100g, 31g protein
- White rice cooked: 130 kcal/100g, 2.7g protein
- Salmon cooked: 208 kcal/100g, 20g protein
- Broccoli cooked: 35 kcal/100g, 2.4g protein
- Olive oil: 884 kcal/100g, 0g protein
- Eggs whole cooked: 155 kcal/100g, 13g protein
- Avocado: 160 kcal/100g, 2g protein
- Almonds: 579 kcal/100g, 21g protein

Rules:
- reference_used: which reference object you used for this specific item, or null
- reference_objects_detected: full list of references visible in the photo, [] if none
- confidence: "high" if reference object calibrated or portion clearly visible, "medium" if estimated, "low" if unclear
- All numeric values must be integers
- questions: 2-4 SPECIFIC follow-ups that would meaningfully change the calorie estimate
- If not a food photo return { "items": [], "questions": [], "reference_objects_detected": [] }`;

const TEXT_IDENTIFY_PROMPT = (description: string) =>
  `You are a precise food identification AI. The user described their meal as: "${description}"

Identify each food item and estimate portions based on the description.
If the user mentions specific amounts use them exactly.
If amounts are vague use standard serving sizes.
Provide fallback calorie/macro estimates per USDA in case the database lookup misses.

Return ONLY valid JSON:
{
  "items": [
    {
      "id": "1",
      "name": "specific food name for database lookup",
      "quantity": "estimated quantity",
      "quantity_grams": 100,
      "cal": 250,
      "p": 8,
      "c": 45,
      "f": 6,
      "confidence": "high"
    }
  ],
  "questions": ["clarifying questions if needed"]
}

Rules:
- All numeric values must be integers
- confidence: "high" if portions specified clearly, "medium" if estimated, "low" if unclear`;

const REFINE_PROMPT = (originalItems: unknown[], context: string) =>
  `You are a precise nutrition AI. You previously identified these foods:
${JSON.stringify(originalItems, null, 2)}

The user provided this additional context:
${context}

Refine your estimates based on this context. Cooking method, specific ingredients, and portion sizes significantly affect accuracy. Update the calories and macros accordingly using USDA nutritional data.

Return ONLY valid JSON: { "items": [...updated items...], "questions": [] }`;

// ── FatSecret helpers ────────────────────────────────────────────────────────
async function getFatSecretToken(): Promise<string | null> {
  const clientId = Deno.env.get('FATSECRET_CLIENT_ID');
  const clientSecret = Deno.env.get('FATSECRET_CLIENT_SECRET');
  if (!clientId || !clientSecret) return null;
  try {
    const res = await fetch(FATSECRET_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials&scope=basic',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token ?? null;
  } catch (e) {
    console.error('[bluai] FatSecret token error:', e);
    return null;
  }
}

async function fatSecretCall(
  token: string,
  params: Record<string, string>,
): Promise<any> {
  const qs = new URLSearchParams({ ...params, format: 'json' }).toString();
  const res = await fetch(`${FATSECRET_API_URL}?${qs}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`FatSecret API ${res.status}`);
  return res.json();
}

async function lookupNutrition(
  token: string,
  foodName: string,
  grams: number,
): Promise<{ cal: number; p: number; c: number; f: number } | null> {
  try {
    const search = await fatSecretCall(token, {
      method: 'foods.search',
      search_expression: foodName,
      max_results: '1',
      page_number: '0',
    });
    const foods = search.foods?.food;
    const first = Array.isArray(foods) ? foods[0] : foods;
    if (!first?.food_id) return null;

    const detail = await fatSecretCall(token, {
      method: 'food.get.v4',
      food_id: String(first.food_id),
    });
    const servings = detail.food?.servings?.serving;
    const serving = Array.isArray(servings) ? servings[0] : servings;
    if (!serving) return null;

    const baseGrams = Number(serving.metric_serving_amount ?? 100) || 100;
    const factor = grams / baseGrams;
    return {
      cal: Math.round(Number(serving.calories ?? 0) * factor),
      p: Math.round(Number(serving.protein ?? 0) * factor * 10) / 10,
      c: Math.round(Number(serving.carbohydrate ?? 0) * factor * 10) / 10,
      f: Math.round(Number(serving.fat ?? 0) * factor * 10) / 10,
    };
  } catch (e) {
    console.error('[bluai] FatSecret lookup failed for', foodName, e);
    return null;
  }
}

// ── Item enrichment ──────────────────────────────────────────────────────────
async function enrichItems(rawItems: any[]): Promise<any[]> {
  const token = await getFatSecretToken();
  return Promise.all(
    rawItems.map(async (item: any, i: number) => {
      const grams = Number(item.quantity_grams);
      const fallback = {
        cal: Math.round(Number(item.cal ?? 0)),
        p: Math.round(Number(item.p ?? 0) * 10) / 10,
        c: Math.round(Number(item.c ?? 0) * 10) / 10,
        f: Math.round(Number(item.f ?? 0) * 10) / 10,
      };
      let macros = fallback;
      let looked: typeof fallback | null = null;
      if (token && Number.isFinite(grams) && grams > 0 && item.name) {
        looked = await lookupNutrition(token, String(item.name), grams);
        if (looked) macros = looked;
      }
      return {
        id: String(item.id ?? i + 1),
        name: String(item.name ?? 'Unknown'),
        quantity: String(item.quantity ?? ''),
        cal: Math.round(macros.cal),
        p: Math.round(macros.p * 10) / 10,
        c: Math.round(macros.c * 10) / 10,
        f: Math.round(macros.f * 10) / 10,
        // Downgrade confidence to 'low' when the FatSecret lookup misses, so
        // the UI can warn the user the macros came from the model's estimate
        // rather than a database match.
        confidence: looked ? (item.confidence ?? 'medium') : 'low',
      };
    }),
  );
}

function buildConfidenceNote(refs: unknown): string | null {
  if (!Array.isArray(refs) || refs.length === 0) return null;
  return `Reference object detected: ${refs.join(', ')} — portions calibrated`;
}

// ── Handler ──────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const {
      base64Image,
      mimeType,
      imageData,
      imageMediaType,
      userNotes,
      hasDepth,
      mode,
      originalItems,
      chipAnswers,
      userNote,
      description,
    } = await req.json();

    const client = new Anthropic({
      apiKey: Deno.env.get('ANTHROPIC_API_KEY'),
    });

    // ── Text mode ────────────────────────────────────────────────────────────
    if (mode === 'text') {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        messages: [
          { role: 'user', content: TEXT_IDENTIFY_PROMPT(description ?? '') },
        ],
      });
      const text =
        response.content[0].type === 'text' ? response.content[0].text : '';
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
      const enrichedItems = await enrichItems(parsed.items ?? []);
      return new Response(
        JSON.stringify({
          items: enrichedItems,
          questions: parsed.questions ?? [],
          confidenceNote: null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Nutrition label mode (read a printed Nutrition Facts panel) ─────────
    if (mode === 'nutrition_label') {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: imageMediaType,
                  data: imageData,
                },
              },
              {
                type: 'text',
                text: `This is a nutrition facts label. Extract the nutrition information exactly as shown on the label.

Return ONLY valid JSON with no other text:
{
  "name": "product name if visible, otherwise 'Scanned Food'",
  "serving_description": "serving size description from label (e.g. '1 cup (240ml)')",
  "serving_size_g": 240,
  "calories": 150,
  "protein_g": 8,
  "carbs_g": 22,
  "fat_g": 3,
  "fiber_g": 2,
  "sugar_g": 10,
  "sodium_mg": 140,
  "saturated_fat_g": 1,
  "cholesterol_mg": 5
}

Rules:
- Use EXACTLY the values shown on the label, do not estimate
- serving_size_g should be the gram equivalent of the serving size
- If a value shows < 1g use 0
- All numeric values must be numbers not strings`,
              },
            ],
          },
        ],
      });

      const text =
        response.content[0].type === 'text' ? response.content[0].text : '';
      const result = JSON.parse(text.replace(/```json|```/g, '').trim());
      return new Response(JSON.stringify({ label: result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Refine mode (unchanged Claude-only flow) ────────────────────────────
    if (mode === 'refine') {
      const answersText = Object.entries(chipAnswers ?? {})
        .map(([q, a]) => `Q: ${q}\nA: ${a}`)
        .join('\n');
      const noteText = userNote?.trim() ? `\nAdditional note: ${userNote}` : '';
      const context = `${answersText}${noteText}`.trim() || 'No extra context.';
      const prompt = REFINE_PROMPT(originalItems ?? [], context);

      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mimeType,
                  data: base64Image,
                },
              },
              { type: 'text', text: prompt },
            ],
          },
        ],
      });
      const text =
        response.content[0].type === 'text' ? response.content[0].text : '';
      const result = JSON.parse(text.replace(/```json|```/g, '').trim());
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Analyze mode (image identify + FatSecret enrich) ────────────────────
    const notesSection = userNotes?.trim()
      ? `\n\nThe user has provided these additional details: ${userNotes}`
      : '';
    const depthSection = hasDepth
      ? '\n\nThis device captured depth data with the photo, so portion-size visual cues are more reliable than usual.'
      : '';
    const prompt = IDENTIFY_PROMPT + notesSection + depthSection;

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: base64Image,
              },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
    });

    const text =
      response.content[0].type === 'text' ? response.content[0].text : '';
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());

    const enrichedItems = await enrichItems(parsed.items ?? []);
    const confidenceNote = buildConfidenceNote(parsed.reference_objects_detected);

    return new Response(
      JSON.stringify({
        items: enrichedItems,
        questions: parsed.questions ?? [],
        confidenceNote,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
