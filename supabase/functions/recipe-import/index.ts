// Supabase Edge Function (Deno runtime) — fetches a recipe webpage, strips
// it to plain text, and asks Claude to extract a structured recipe.
//
// Deploy with: supabase functions deploy recipe-import
// Requires:    supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
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
    const { url } = await req.json();
    if (!url) throw new Error('URL is required');

    const pageRes = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BluCal/1.0)' },
    });
    if (!pageRes.ok) throw new Error('Could not fetch recipe page');
    const html = await pageRes.text();

    // Strip scripts, styles, and tags to keep the LLM context cheap and
    // focused on visible text. Truncate to 8000 chars so we stay well
    // under the model's input budget.
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8000);

    const client = new Anthropic({
      apiKey: Deno.env.get('ANTHROPIC_API_KEY'),
    });

    const response = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Extract the recipe from this webpage text and return ONLY valid JSON with no other text:

{
  "name": "Recipe name",
  "servings": 4,
  "ingredients": [
    {
      "name": "ingredient name",
      "quantity": 100,
      "unit": "g",
      "calories": 50,
      "protein_g": 2,
      "carbs_g": 8,
      "fat_g": 1
    }
  ]
}

Estimate calories and macros for each ingredient based on standard nutritional data.
If you cannot find a recipe in this text return { "error": "No recipe found" }.

Webpage text:
${text}`,
        },
      ],
    });

    const content =
      response.content[0].type === 'text' ? response.content[0].text : '';
    const cleaned = content.replace(/```json|```/g, '').trim();
    const result = JSON.parse(cleaned);

    if (result.error) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
