// Apple Health bridge — backed by `react-native-health`.
//
// HealthKit is iOS-only and requires a dev build. In Expo Go, on Android,
// in the simulator, or in any environment where the native module is not
// linked, every call here resolves with a safe fallback (false / null / 0
// / undefined) instead of throwing. The rest of the app (food / weight /
// water logging) can therefore continue to work normally everywhere.
import AppleHealthKit, {
  type HealthKitPermissions,
  type HealthValue,
} from 'react-native-health';

const PERMISSIONS: HealthKitPermissions = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.Weight,
      AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
      AppleHealthKit.Constants.Permissions.StepCount,
    ],
    write: [
      AppleHealthKit.Constants.Permissions.EnergyConsumed,
      AppleHealthKit.Constants.Permissions.Protein,
      AppleHealthKit.Constants.Permissions.Carbohydrates,
      AppleHealthKit.Constants.Permissions.FatTotal,
      AppleHealthKit.Constants.Permissions.Water,
      AppleHealthKit.Constants.Permissions.Weight,
    ],
  },
};

// Wrap callback-style native calls so any synchronous TypeError (e.g.
// AppleHealthKit being undefined when the module isn't linked) resolves
// to the fallback rather than blowing up the caller.
const safePromise = <T>(
  build: (resolve: (value: T) => void) => void,
  fallback: T,
): Promise<T> =>
  new Promise<T>((resolve) => {
    try {
      build(resolve);
    } catch (e) {
      console.error('[appleHealth]', e);
      resolve(fallback);
    }
  });

export const isAvailable = (): Promise<boolean> =>
  safePromise<boolean>((resolve) => {
    AppleHealthKit.isAvailable((err, available) => {
      console.log('HealthKit isAvailable:', available, 'error:', err);
      resolve(!err && Boolean(available));
    });
  }, false);

export const requestPermissions = (): Promise<boolean> =>
  safePromise<boolean>((resolve) => {
    AppleHealthKit.initHealthKit(PERMISSIONS, (err) => {
      resolve(!err);
    });
  }, false);

export const writeNutrition = async (entry: {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  logged_at: string;
}): Promise<void> => {
  const date = new Date(entry.logged_at).toISOString();
  try {
    await Promise.allSettled([
      new Promise<void>((resolve) => {
        AppleHealthKit.saveFood(
          // saveFood's `Options` shape varies by lib version; cast keeps us
          // compatible without losing the runtime structure the lib expects.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          { value: entry.calories, date, unit: 'calorie' } as any,
          () => resolve(),
        );
      }),
    ]);
  } catch (e) {
    console.error('[appleHealth] writeNutrition', e);
  }
};

export const writeWeight = (weightKg: number, date: string): Promise<void> =>
  safePromise<void>((resolve) => {
    AppleHealthKit.saveWeight(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { value: weightKg * 2.20462, date: new Date(date).toISOString() } as any,
      () => resolve(),
    );
  }, undefined);

export const writeWater = (amountOz: number, date: string): Promise<void> =>
  safePromise<void>((resolve) => {
    const amountMl = amountOz * 29.5735;
    AppleHealthKit.saveWater(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { value: amountMl, date: new Date(date).toISOString() } as any,
      () => resolve(),
    );
  }, undefined);

export const readLatestWeight = (): Promise<number | null> =>
  safePromise<number | null>((resolve) => {
    AppleHealthKit.getLatestWeight(
      { unit: AppleHealthKit.Constants.Units.pound },
      (err, result) => {
        if (err || !result) {
          resolve(null);
          return;
        }
        // Convert pounds back to kilograms for storage parity.
        resolve((result as HealthValue).value / 2.20462);
      },
    );
  }, null);

export const readTodaySteps = (): Promise<number> =>
  safePromise<number>((resolve) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    AppleHealthKit.getStepCount(
      // The runtime expects `{ date }` but the lib's typings declare
      // `HealthValueOptions` (startDate/endDate). Cast to bridge the gap.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { date: start.toISOString() } as any,
      (err, result) => {
        if (err || !result) {
          resolve(0);
          return;
        }
        resolve((result as HealthValue).value ?? 0);
      },
    );
  }, 0);
