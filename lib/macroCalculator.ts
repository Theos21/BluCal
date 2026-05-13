import type { Pace } from './types';

export type Targets = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  tdee: number;
  // Signed weekly change (kg). Negative for cuts, positive for bulks,
  // zero for maintenance / performance.
  weeklyChangeKg: number;
};

// Mifflin-St Jeor BMR -> activity-adjusted TDEE -> pace-adjusted calories,
// with absolute safety floors for cuts and a hard cap on bulks.
export function calculateMacroTargets(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: string,
  activityLevel: string,
  goal: string,
  pace: Pace,
): Targets {
  let bmr: number;
  if (sex === 'male' || sex === 'Male') {
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  } else {
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  }

  const multipliers: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    very_active: 1.725,
    athlete: 1.9,
  };
  const tdee = Math.round(bmr * (multipliers[activityLevel] ?? 1.55));

  const loseAdjustments: Record<Pace, number> = {
    slow: -250,
    moderate: -500,
    aggressive: -750,
  };
  const gainAdjustments: Record<Pace, number> = {
    slow: 150,
    moderate: 300,
    aggressive: 500,
  };

  let calories: number;
  if (goal === 'lose_fat') {
    const adjustment = loseAdjustments[pace];
    const floor = sex === 'male' || sex === 'Male' ? 1500 : 1200;
    calories = Math.max(floor, tdee + adjustment);
  } else if (goal === 'build_muscle') {
    const adjustment = gainAdjustments[pace];
    calories = Math.min(tdee + 600, tdee + adjustment);
  } else {
    calories = tdee;
  }

  const protein_g = Math.round((calories * 0.3) / 4);
  const carbs_g = Math.round((calories * 0.45) / 4);
  const fat_g = Math.round((calories * 0.25) / 9);

  // 7700 kcal per kg of fat. Negative for loss, positive for gain.
  let weeklyChangeKg = 0;
  if (goal === 'lose_fat') {
    weeklyChangeKg = (loseAdjustments[pace] * 7) / 7700;
  } else if (goal === 'build_muscle') {
    weeklyChangeKg = (gainAdjustments[pace] * 7) / 7700;
  }

  return { calories, protein_g, carbs_g, fat_g, tdee, weeklyChangeKg };
}

export function ageFromBirthday(
  birthday: string | null | undefined,
): number | null {
  if (!birthday) return null;
  const dob = new Date(birthday);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

// Convenience variant of ageFromBirthday with a built-in 30-year default
// for when no birthday is set yet (used by Coach goal-pacing math).
export const calculateAge = (
  birthday: string | null | undefined,
): number => ageFromBirthday(birthday) ?? 30;

// Inverse: convert an age (years) into a YYYY-MM-DD birthday string for
// storing in `profiles.birthday`. The actual day/month is approximate.
export function birthdayFromAge(age: number): string {
  const today = new Date();
  const d = new Date(
    today.getFullYear() - age,
    today.getMonth(),
    today.getDate(),
  );
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
