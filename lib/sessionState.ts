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
};
