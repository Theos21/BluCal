// Supabase Edge Function (Deno runtime) — proxies BluCoach chat replies
// and weekly insight generation to the Anthropic Claude API.
//
// Deploy with: supabase functions deploy coach
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
    const {
      weeklyAvgCal,
      targetCal,
      weightTrend,
      streak,
      goalPacing,
      goal,
      pace,
      topMissedMacro,
      daysLogged,
      userName,
      conversationHistory,
      userMessage,
    } = await req.json();

    const client = new Anthropic({
      apiKey: Deno.env.get('ANTHROPIC_API_KEY'),
    });

    const systemPrompt = `You are a supportive, knowledgeable nutrition coach inside the BluCal app. Your name is BluCoach.

User context:
- Name: ${userName ?? 'there'}
- Goal: ${goal ?? 'not set'}
- Pace: ${pace ?? 'moderate'}
- Weekly calorie average: ${weeklyAvgCal > 0 ? weeklyAvgCal + ' kcal' : 'not enough data yet'}
- Calorie target: ${targetCal} kcal
- Weight trend: ${weightTrend ?? 'not enough data'}
- Current streak: ${streak} days
- Goal pacing: ${goalPacing ?? 'not enough data'}
- Days logged this week: ${daysLogged}
- Most missed macro: ${topMissedMacro ?? 'none identified yet'}

Guidelines:
- Be warm, encouraging, and specific, not generic
- Reference their actual data when giving advice
- Keep responses concise. 2 to 4 sentences max unless they ask a detailed question
- Never use em dashes
- Never make medical claims
- If they have less than 3 days of data, acknowledge you are still learning their patterns
- Use plain language, no jargon`;

    const messages = [
      ...(conversationHistory ?? []),
      { role: 'user', content: userMessage },
    ];

    const response = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 300,
      system: systemPrompt,
      messages,
    });

    const reply =
      response.content[0].type === 'text' ? response.content[0].text : '';

    return new Response(JSON.stringify({ reply }), {
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
