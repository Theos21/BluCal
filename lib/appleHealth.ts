// Apple Health bridge — intentionally stubbed.
//
// The `react-native-health` (HealthKit) integration was removed from the
// BluCal binary. These no-op stubs preserve the module's public API so any
// caller keeps compiling and behaves as if HealthKit is simply unavailable
// on every platform.

export const isAvailable = (): Promise<boolean> => Promise.resolve(false);

export const requestPermissions = (): Promise<boolean> =>
  Promise.resolve(false);

export const initializeHealthKit = (): Promise<boolean> =>
  Promise.resolve(false);

export const writeNutrition = async (_entry: {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  logged_at: string;
}): Promise<void> => {};

export const writeWeight = async (
  _weightKg: number,
  _date: string,
): Promise<void> => {};

export const writeWater = async (
  _amountOz: number,
  _date: string,
): Promise<void> => {};

export const readLatestWeight = (): Promise<number | null> =>
  Promise.resolve(null);

export const readTodaySteps = (): Promise<number> => Promise.resolve(0);
