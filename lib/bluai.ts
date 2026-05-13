import { supabase } from './supabase';

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

export const analyzeMealPhoto = async (
  base64Image: string,
  mimeType: BluAIMimeType,
  userNotes?: string,
): Promise<BluAIResult> => {
  const { data, error } = await supabase.functions.invoke('bluai', {
    body: { base64Image, mimeType, userNotes, mode: 'analyze' },
  });
  if (error) throw error;
  return data as BluAIResult;
};

export const refineMealAnalysis = async (
  base64Image: string,
  mimeType: BluAIMimeType,
  originalItems: BluAIFoodItem[],
  chipAnswers: Record<string, string>,
  userNote: string,
): Promise<BluAIResult> => {
  const { data, error } = await supabase.functions.invoke('bluai', {
    body: {
      base64Image,
      mimeType,
      originalItems,
      chipAnswers,
      userNote,
      mode: 'refine',
    },
  });
  if (error) throw error;
  return data as BluAIResult;
};
