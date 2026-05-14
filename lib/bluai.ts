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
): Promise<BluAIResult> => {
  return invokeBluAI({ base64Image, mimeType, userNotes, mode: 'analyze' });
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
