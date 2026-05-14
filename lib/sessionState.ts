// Simple in-memory session state. Resets when the app is fully killed.
// Not persisted to storage. For within-session UI state only.

let _feelingDismissed = false;
let _justLoggedFood: string | null = null;
let _celebrationDismissedForStreak: number = 0;
let _bluAITipDismissed = false;

export const sessionState = {
  getFeelingDismissed: () => _feelingDismissed,
  setFeelingDismissed: (val: boolean) => {
    _feelingDismissed = val;
  },
  getJustLoggedFood: () => _justLoggedFood,
  setJustLoggedFood: (name: string | null) => {
    _justLoggedFood = name;
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
