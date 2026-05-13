import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '',
  dangerouslyAllowBrowser: true,
});

// Default to the latest Claude vision-capable Opus model. Override here if you
// want to pin a specific version for cost or reproducibility reasons.
const BLUAI_MODEL = 'claude-opus-4-7';

export type BluAIMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

export interface BluAIFoodItem {
  id: string;
  name: string;
  quantity: string;
  cal: number;
  p: number;
  c: number;
  f: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface BluAIResult {
  items: BluAIFoodItem[];
  questions: string[];
}

function extractText(content: Anthropic.Messages.ContentBlock[]): string {
  const block = content[0];
  return block && block.type === 'text' ? block.text : '';
}

function parseResult(raw: string): BluAIResult {
  const cleaned = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned) as BluAIResult;
}

export const analyzeMealPhoto = async (
  base64Image: string,
  mimeType: BluAIMimeType,
  userNotes?: string,
): Promise<BluAIResult> => {
  const notesSection = userNotes?.trim()
    ? `\n\nThe user has provided these additional details: ${userNotes}`
    : '';

  const response = await client.messages.create({
    model: BLUAI_MODEL,
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
          {
            type: 'text',
            text: `You are a nutrition AI. Analyze this meal photo and return a JSON object.${notesSection}

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
- If this is not a food photo, return { "items": [], "questions": [] }`,
          },
        ],
      },
    ],
  });

  return parseResult(extractText(response.content));
};

export const refineMealAnalysis = async (
  base64Image: string,
  mimeType: BluAIMimeType,
  originalItems: BluAIFoodItem[],
  chipAnswers: Record<string, string>,
  userNote: string,
): Promise<BluAIResult> => {
  const answersText = Object.entries(chipAnswers)
    .map(([q, a]) => `Q: ${q}\nA: ${a}`)
    .join('\n');
  const noteText = userNote.trim() ? `\nAdditional note: ${userNote}` : '';
  const contextText =
    answersText || noteText
      ? `\n\nThe user has provided additional context:\n${answersText}${noteText}`
      : '';

  const originalText = JSON.stringify(originalItems);

  const response = await client.messages.create({
    model: BLUAI_MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: base64Image },
          },
          {
            type: 'text',
            text: `You are a nutrition AI. You previously identified these foods in this meal photo:
${originalText}${contextText}

Please refine your estimates based on the additional context provided. Return ONLY valid JSON with the same structure as before. Improve confidence levels where the additional context helps. Return only the updated items array, no new questions needed.

Return ONLY valid JSON:
{ "items": [...], "questions": [] }`,
          },
        ],
      },
    ],
  });

  return parseResult(extractText(response.content));
};
