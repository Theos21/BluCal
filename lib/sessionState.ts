// Simple in-memory session state. Resets when the app is fully killed.
// Not persisted to storage. For within-session UI state only.

let _feelingDismissed = false;
let _justLoggedFood: string | null = null;

export const sessionState = {
  getFeelingDismissed: () => _feelingDismissed,
  setFeelingDismissed: (val: boolean) => {
    _feelingDismissed = val;
  },
  getJustLoggedFood: () => _justLoggedFood,
  setJustLoggedFood: (name: string | null) => {
    _justLoggedFood = name;
  },
};
