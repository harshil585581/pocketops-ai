import { Car, Droplets, Laptop, WashingMachine, Wifi, Wrench, Zap, type LucideIcon } from 'lucide-react';
import type { CategoryId } from './types';

export interface Category {
  id: CategoryId;
  label: string;
  icon: LucideIcon;
  /** Tinted icon tile classes. */
  tint: string;
  keywords: string[];
}

export const CATEGORIES: Category[] = [
  { id: 'electronics', label: 'Electronics', icon: Laptop, tint: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300', keywords: ['laptop', 'phone', 'computer', 'pc', 'tablet', 'screen', 'battery', 'charger', 'charging', 'tv', 'printer', 'monitor', 'keyboard'] },
  { id: 'appliance', label: 'Appliances', icon: WashingMachine, tint: 'bg-sky-500/10 text-sky-600 dark:text-sky-300', keywords: ['washing', 'washer', 'dryer', 'fridge', 'refrigerator', 'freezer', 'dishwasher', 'oven', 'microwave', 'air conditioner', 'heater', 'boiler'] },
  { id: 'vehicle', label: 'Vehicle', icon: Car, tint: 'bg-rose-500/10 text-rose-600 dark:text-rose-300', keywords: ['car', 'engine', 'bike', 'motorcycle', 'truck', 'tyre', 'tire', 'brake', 'starter', 'ignition', 'vehicle'] },
  { id: 'network', label: 'Network', icon: Wifi, tint: 'bg-violet-500/10 text-violet-600 dark:text-violet-300', keywords: ['wifi', 'wi-fi', 'router', 'internet', 'network', 'modem', 'ethernet', 'bluetooth', 'signal'] },
  { id: 'electrical', label: 'Electrical', icon: Zap, tint: 'bg-amber-500/12 text-amber-600 dark:text-amber-300', keywords: ['breaker', 'fuse', 'socket', 'outlet', 'wiring', 'switch', 'light', 'circuit', 'generator', 'inverter', 'trips', 'tripping'] },
  { id: 'plumbing', label: 'Plumbing', icon: Droplets, tint: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-300', keywords: ['leak', 'pipe', 'tap', 'faucet', 'toilet', 'pump', 'clog', 'sink'] },
  { id: 'other', label: 'Other', icon: Wrench, tint: 'bg-slate-500/10 text-slate-600 dark:text-slate-300', keywords: [] },
];

export const categoryById = (id: CategoryId) =>
  CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];

/** Lightweight keyword-based guess used when the user hasn't picked a category. */
export function detectCategory(text: string): CategoryId {
  const t = text.toLowerCase();
  let best: CategoryId = 'other';
  let score = 0;
  for (const c of CATEGORIES) {
    const s = c.keywords.reduce((n, k) => n + (t.includes(k) ? 1 : 0), 0);
    if (s > score) {
      score = s;
      best = c.id;
    }
  }
  return best;
}
