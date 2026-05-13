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
    } = await req.json();

    const client = new Anthropic({
      apiKey: Deno.env.get('ANTHROPIC_API_KEY'),
    });

    let prompt = '';

    if (mode === 'analyze') {
      const notesSection = userNotes?.trim()
        ? `\n\nThe user has provided these additional details: ${userNotes}`
        : '';
      prompt = `You are a nutrition AI. Analyze this meal photo and return a JSON object.${notesSection}

Return ONLY valid JSON with no other text, markdown, or explanation. The JSON must match this exact structure:
{
  "items": [
    {
      "id": "1",
      "name": "food name",
      "quantity": "estimated quantity with unit (e.g. 2 slices, 150g, 1 cup)",
      "cal": 250,
      "p": 12,
      "c": 30,
      "f": 8,
      "confidence": "high"
    }
  ],
  "questions": [
    "What dressing was used?",
    "Was this grilled or fried?"
  ]
}

Rules:
- List each distinct food item separately
- Estimate calories and macros per the quantity shown
- confidence must be "high", "medium", or "low"
- questions should be 2-4 specific follow-up questions that would meaningfully improve accuracy for THIS specific meal
- If you are confident about everything, return an empty questions array
- All numeric values must be integers
- If this is not a food photo, return { "items": [], "questions": [] }`;
    } else {
      const answersText = Object.entries(chipAnswers ?? {})
        .map(([q, a]) => `Q: ${q}\nA: ${a}`)
        .join('\n');
      const noteText = userNote?.trim()
        ? `\nAdditional note: ${userNote}`
        : '';
      const contextText =
        answersText || noteText
          ? `\n\nThe user has provided additional context:\n${answersText}${noteText}`
          : '';
      prompt = `You are a nutrition AI. You previously identified these foods in this meal photo:
${JSON.stringify(originalItems)}${contextText}

Please refine your estimates based on the additional context provided. Return ONLY valid JSON:
{ "items": [...], "questions": [] }`;
    }

    const response = await client.messages.create({
      model: 'claude-opus-4-7',
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
