import { supabase } from './supabase';

export interface CoachMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CoachContext {
  weeklyAvgCal: number;
  targetCal: number;
  weightTrend: string;
  streak: number;
  goalPacing: string;
  goal: string;
  pace: string;
  topMissedMacro: string | null;
  daysLogged: number;
  userName: string;
}

export const askCoach = async (
  userMessage: string,
  context: CoachContext,
  conversationHistory: CoachMessage[],
): Promise<string> => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const { data, error } = await supabase.functions.invoke('coach', {
    body: {
      ...context,
      userMessage,
      conversationHistory: conversationHistory.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    },
  });

  if (error) throw error;
  if (!data?.reply) throw new Error('No response from coach');
  return data.reply as string;
};
