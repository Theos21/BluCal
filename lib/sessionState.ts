// Simple in-memory session state. Resets when the app is fully killed.
// Not persisted to storage. For within-session UI state only.

let _feelingDismissed = false;
let _justLoggedFood: string | null = null;
let _celebrationDismissedForStreak: number = 0;
let _bluAITipDismissed = false;
// Set by screens that mutate data (logging food, creating a custom food or
// recipe) so a screen regaining focus knows to refetch its lists immediately
// rather than waiting for a pull-to-refresh.
let _needsRefresh = false;
// Name captured from Apple Sign In's credential.fullName. Set immediately on
// sign-in so onboarding can hide the name field even before the profile row
// has loaded from Supabase.
let _appleSignInName: string | null = null;

export const sessionState = {
  getFeelingDismissed: () => _feelingDismissed,
  setFeelingDismissed: (val: boolean) => {
    _feelingDismissed = val;
  },
  getJustLoggedFood: () => _justLoggedFood,
  setJustLoggedFood: (name: string | null) => {
    _justLoggedFood = name;
  },
  getNeedsRefresh: () => _needsRefresh,
  setNeedsRefresh: (val: boolean) => {
    _needsRefresh = val;
  },
  getCelebrationDismissedForStreak: () => _celebrationDismissedForStreak,
  setCelebrationDismissedForStreak: (streak: number) => {
    _celebrationDismissedForStreak = streak;
  },
  getBluAITipDismissed: () => _bluAITipDismissed,
  setBluAITipDismissed: () => {
    _bluAITipDismissed = true;
  },
  getAppleSignInName: () => _appleSignInName,
  setAppleSignInName: (name: string | null) => {
    _appleSignInName = name;
  },
};
