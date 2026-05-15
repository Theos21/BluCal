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
  confidenceNote?: string | null;
}

export type BluAIError =
  | 'not_authenticated'
  | 'network_error'
  | 'analysis_failed'
  | 'invalid_response';

export class BluAIException extends Error {
  constructor(
    public code: BluAIError,
    message: string,
  ) {
    super(message);
    this.name = 'BluAIException';
  }
}

const invokeBluAI = async (
  body: Record<string, unknown>,
): Promise<BluAIResult> => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new BluAIException(
      'not_authenticated',
      'Please sign in to use BluAI.',
    );
  }

  const { data, error } = await supabase.functions.invoke('bluai', { body });

  if (error) {
    const msg = error.message?.toLowerCase() ?? '';
    if (
      msg.includes('401') ||
      msg.includes('unauthorized') ||
      msg.includes('jwt')
    ) {
      throw new BluAIException(
        'not_authenticated',
        'Session expired. Please sign in again.',
      );
    }
    throw new BluAIException(
      'network_error',
      'Could not reach BluAI. Check your connection and try again.',
    );
  }

  if (!data || data.error) {
    throw new BluAIException(
      'analysis_failed',
      data?.error ?? 'BluAI could not analyze the image.',
    );
  }

  if (!Array.isArray(data.items)) {
    throw new BluAIException(
      'invalid_response',
      'Unexpected response from BluAI. Please try again.',
    );
  }

  return data as BluAIResult;
};

export const analyzeMealPhoto = async (
  base64Image: string,
  mimeType: BluAIMimeType,
  userNotes?: string,
  hasDepth?: boolean,
): Promise<BluAIResult> => {
  return invokeBluAI({
    base64Image,
    mimeType,
    userNotes,
    hasDepth,
    mode: 'analyze',
  });
};

export const refineMealAnalysis = async (
  base64Image: string,
  mimeType: BluAIMimeType,
  originalItems: BluAIFoodItem[],
  chipAnswers: Record<string, string>,
  userNote: string,
): Promise<BluAIResult> => {
  return invokeBluAI({
    base64Image,
    mimeType,
    originalItems,
    chipAnswers,
    userNote,
    mode: 'refine',
  });
};

export const analyzeTextDescription = async (
  description: string,
): Promise<BluAIResult> => {
  return invokeBluAI({ description, mode: 'text' });
};

export interface NutritionLabelResult {
  name: string;
  serving_description: string;
  serving_size_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  saturated_fat_g: number;
  cholesterol_mg: number;
}

export const scanNutritionLabel = async (
  base64: string,
  mimeType: string,
): Promise<NutritionLabelResult> => {
  const { data, error } = await supabase.functions.invoke('bluai', {
    body: {
      mode: 'nutrition_label',
      imageData: base64,
      imageMediaType: mimeType,
    },
  });
  if (error) {
    throw new BluAIException(
      'network_error',
      'Could not read nutrition label.',
    );
  }
  if (!data?.label) {
    throw new BluAIException('invalid_response', 'Could not read label data.');
  }
  return data.label as NutritionLabelResult;
};
