import type { FoodEntry } from './types';

export interface MealGroup {
  id: string;
  time: string;
  totalCal: number;
  totalP: number;
  totalC: number;
  totalF: number;
  items: FoodEntry[];
}

export function parseLoggedAt(logged_at: string): number {
  const date = new Date(logged_at);
  return date.getHours() * 60 + date.getMinutes();
}

export function formatDisplayTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${m.toString().padStart(2, '0')} ${ampm}`;
}

export function groupEntries(entries: FoodEntry[]): MealGroup[] {
  if (entries.length === 0) return [];
  const sorted = [...entries].sort(
    (a, b) => parseLoggedAt(a.logged_at) - parseLoggedAt(b.logged_at),
  );
  const groups: MealGroup[] = [];
  let currentGroup: FoodEntry[] = [sorted[0]];
  let groupStartMinutes = parseLoggedAt(sorted[0].logged_at);

  for (let i = 1; i < sorted.length; i++) {
    const entryMinutes = parseLoggedAt(sorted[i].logged_at);
    if (entryMinutes - groupStartMinutes <= 15) {
      currentGroup.push(sorted[i]);
    } else {
      groups.push(buildGroup(currentGroup, groupStartMinutes));
      currentGroup = [sorted[i]];
      groupStartMinutes = entryMinutes;
    }
  }
  groups.push(buildGroup(currentGroup, groupStartMinutes));
  return groups;
}

function buildGroup(items: FoodEntry[], startMinutes: number): MealGroup {
  return {
    id: items[0].id,
    time: formatDisplayTime(startMinutes),
    totalCal: items.reduce((s, e) => s + e.calories, 0),
    totalP: items.reduce((s, e) => s + Number(e.protein_g), 0),
    totalC: items.reduce((s, e) => s + Number(e.carbs_g), 0),
    totalF: items.reduce((s, e) => s + Number(e.fat_g), 0),
    items,
  };
}
