// Supabase Edge Function (Deno runtime) — proxies BluAI meal-photo analysis
// to the Anthropic Claude API.
//
// Deploy with: supabase functions deploy bluai
// Set the API key with: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
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

const ANALYZE_PROMPT = `You are a precise nutrition AI with expertise in food science and dietetics. Analyze this meal photo carefully.

When estimating portions, use these visual reference points:
- A fist = ~1 cup
- A palm = ~3oz protein
- A thumb = ~1 tablespoon
- A cupped hand = ~1/2 cup
- A deck of cards = ~3oz meat

Common calorie references to calibrate your estimates:
- 1 large egg = 70 kcal
- 1 slice bread = 80 kcal
- 1 cup cooked rice = 200 kcal
- 1 tbsp olive oil = 120 kcal
- 1 chicken breast (6oz) = 280 kcal
- 1 cup whole milk = 150 kcal

For each food item:
1. Identify the food precisely (cooking method matters — grilled vs fried changes calories significantly)
2. Estimate the portion size using visual cues in the image
3. Calculate macros based on USDA nutritional data for that specific food and portion
4. Set confidence based on how clearly visible and identifiable the food is

Return ONLY valid JSON, no other text:
{
  "items": [
    {
      "id": "1",
      "name": "food name (specific, e.g. 'Grilled chicken breast' not just 'chicken')",
      "quantity": "estimated quantity (e.g. '6 oz', '1 cup', '2 slices')",
      "cal": 280,
      "p": 53,
      "c": 0,
      "f": 6,
      "confidence": "high"
    }
  ],
  "questions": [
    "Was the chicken grilled, fried, or baked?",
    "What type of dressing was used on the salad?"
  ]
}

Rules:
- Be specific about cooking methods — they significantly affect calories
- List each distinct food item separately
- questions should be 2-4 SPECIFIC follow-up questions that would meaningfully change the calorie estimate for THIS meal
- confidence: "high" = clearly visible portion, "medium" = estimated portion, "low" = unclear
- All numeric values must be integers
- If not a food photo return { "items": [], "questions": [] }`;

const REFINE_PROMPT = (originalItems: unknown[], context: string) =>
  `You are a precise nutrition AI. You previously identified these foods:
${JSON.stringify(originalItems, null, 2)}

The user provided this additional context:
${context}

Refine your estimates based on this context. Cooking method, specific ingredients, and portion sizes significantly affect accuracy. Update the calories and macros accordingly using USDA nutritional data.

Return ONLY valid JSON: { "items": [...updated items...], "questions": [] }`;

const TEXT_PROMPT = (description: string) =>
  `You are a precise nutrition AI. The user described their meal as: "${description}"

Using USDA nutritional data, estimate the calories and macros for this meal.
Be specific about portions based on the description.
If portions are vague (e.g. "a bagel") use standard/medium serving sizes.

Return ONLY valid JSON:
{
  "items": [
    {
      "id": "1",
      "name": "specific food name",
      "quantity": "estimated quantity",
      "cal": 250,
      "p": 8,
      "c": 45,
      "f": 6,
      "confidence": "medium"
    }
  ],
  "questions": ["Any clarifying questions to improve accuracy"]
}`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const {
      base64Image,
      mimeType,
      userNotes,
      mode,
      originalItems,
      chipAnswers,
      userNote,
      description,
    } = await req.json();

    const client = new Anthropic({
      apiKey: Deno.env.get('ANTHROPIC_API_KEY'),
    });

    if (mode === 'text') {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: TEXT_PROMPT(description ?? ''),
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

    let prompt = '';

    if (mode === 'analyze') {
      const notesSection = userNotes?.trim()
        ? `\n\nThe user has provided these additional details: ${userNotes}`
        : '';
      prompt = ANALYZE_PROMPT + notesSection;
    } else {
      const answersText = Object.entries(chipAnswers ?? {})
        .map(([q, a]) => `Q: ${q}\nA: ${a}`)
        .join('\n');
      const noteText = userNote?.trim() ? `\nAdditional note: ${userNote}` : '';
      const context = `${answersText}${noteText}`.trim() || 'No extra context.';
      prompt = REFINE_PROMPT(originalItems ?? [], context);
    }

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
    const cleaned = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(cleaned);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
