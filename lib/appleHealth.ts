// Apple Health bridge backed by @kingstinct/react-native-healthkit.
//
// HealthKit is iOS-only and requires a dev build. On Android or in Expo Go
// every call here resolves with a safe fallback (false / null / 0 / undefined)
// instead of throwing, so the rest of the app keeps working everywhere.
import {
  isHealthDataAvailable,
  queryQuantitySamples,
  requestAuthorization,
  saveQuantitySample,
} from '@kingstinct/react-native-healthkit';
import { Platform } from 'react-native';

const READ_PERMISSIONS = [
  'HKQuantityTypeIdentifierBodyMass',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierStepCount',
] as const;

const WRITE_PERMISSIONS = [
  'HKQuantityTypeIdentifierDietaryEnergyConsumed',
  'HKQuantityTypeIdentifierDietaryProtein',
  'HKQuantityTypeIdentifierDietaryCarbohydrates',
  'HKQuantityTypeIdentifierDietaryFatTotal',
  'HKQuantityTypeIdentifierDietaryWater',
  'HKQuantityTypeIdentifierBodyMass',
] as const;

export const isAvailable = async (): Promise<boolean> => {
  if (Platform.OS !== 'ios') return false;
  try {
    return isHealthDataAvailable();
  } catch (e) {
    console.error('[appleHealth] isAvailable error:', e);
    return false;
  }
};

export const requestPermissions = async (): Promise<boolean> => {
  if (Platform.OS !== 'ios') return false;
  try {
    await requestAuthorization({
      // The library's strict identifier unions diverge from the raw
      // HKQuantityTypeIdentifier* string names we use here, so we widen.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toShare: WRITE_PERMISSIONS as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toRead: READ_PERMISSIONS as any,
    });
    return true;
  } catch (e) {
    console.error('[appleHealth] requestPermissions error:', e);
    return false;
  }
};

export const initializeHealthKit = async (): Promise<boolean> => {
  return requestPermissions();
};

export const writeNutrition = async (entry: {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  logged_at: string;
}): Promise<void> => {
  if (Platform.OS !== 'ios') return;
  try {
    const date = new Date(entry.logged_at);
    await Promise.allSettled([
      saveQuantitySample(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'HKQuantityTypeIdentifierDietaryEnergyConsumed' as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'kcal' as any,
        entry.calories,
        date,
        date,
      ),
      saveQuantitySample(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'HKQuantityTypeIdentifierDietaryProtein' as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'g' as any,
        entry.protein_g,
        date,
        date,
      ),
      saveQuantitySample(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'HKQuantityTypeIdentifierDietaryCarbohydrates' as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'g' as any,
        entry.carbs_g,
        date,
        date,
      ),
      saveQuantitySample(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'HKQuantityTypeIdentifierDietaryFatTotal' as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'g' as any,
        entry.fat_g,
        date,
        date,
      ),
    ]);
  } catch (e) {
    console.error('[appleHealth] writeNutrition error:', e);
  }
};

export const writeWeight = async (
  weightKg: number,
  date: string,
): Promise<void> => {
  if (Platform.OS !== 'ios') return;
  try {
    const d = new Date(date);
    await saveQuantitySample(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'HKQuantityTypeIdentifierBodyMass' as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'kg' as any,
      weightKg,
      d,
      d,
    );
  } catch (e) {
    console.error('[appleHealth] writeWeight error:', e);
  }
};

export const writeWater = async (
  amountOz: number,
  date: string,
): Promise<void> => {
  if (Platform.OS !== 'ios') return;
  try {
    const d = new Date(date);
    const amountMl = amountOz * 29.5735;
    await saveQuantitySample(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'HKQuantityTypeIdentifierDietaryWater' as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'mL' as any,
      amountMl,
      d,
      d,
    );
  } catch (e) {
    console.error('[appleHealth] writeWater error:', e);
  }
};

export const readLatestWeight = async (): Promise<number | null> => {
  if (Platform.OS !== 'ios') return null;
  try {
    const samples = await queryQuantitySamples(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'HKQuantityTypeIdentifierBodyMass' as any,
      {
        filter: {
          date: {
            startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            endDate: new Date(),
          },
        },
        limit: 1,
        ascending: false,
      },
    );
    if (!samples || samples.length === 0) return null;
    return samples[0].quantity;
  } catch (e) {
    console.error('[appleHealth] readLatestWeight error:', e);
    return null;
  }
};

export const readTodaySteps = async (): Promise<number> => {
  if (Platform.OS !== 'ios') return 0;
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const samples = await queryQuantitySamples(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'HKQuantityTypeIdentifierStepCount' as any,
      {
        filter: { date: { startDate: start, endDate: new Date() } },
        limit: 0,
      },
    );
    return samples?.reduce((s: number, e) => s + e.quantity, 0) ?? 0;
  } catch (e) {
    console.error('[appleHealth] readTodaySteps error:', e);
    return 0;
  }
};
