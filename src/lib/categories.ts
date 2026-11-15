import { Car, Droplets, Laptop, WashingMachine, Wifi, Wrench, Zap, type LucideIcon } from 'lucide-react';
import type { CategoryId } from './types';

export interface Category {
  id: CategoryId;
  label: string;
  icon: LucideIcon;
  keywords: string[];
}

export const CATEGORIES: Category[] = [
  { id: 'electronics', label: 'Electronics', icon: Laptop, keywords: ['laptop', 'phone', 'computer', 'pc', 'tablet', 'screen', 'battery', 'charger', 'charging', 'tv', 'printer', 'monitor', 'keyboard'] },
  { id: 'appliance', label: 'Appliances', icon: WashingMachine, keywords: ['washing', 'washer', 'dryer', 'fridge', 'refrigerator', 'freezer', 'dishwasher', 'oven', 'microwave', 'air conditioner', 'heater', 'boiler'] },
  { id: 'vehicle', label: 'Vehicle', icon: Car, keywords: ['car', 'engine', 'bike', 'motorcycle', 'truck', 'tyre', 'tire', 'brake', 'starter', 'ignition', 'vehicle'] },
  { id: 'network', label: 'Network', icon: Wifi, keywords: ['wifi', 'wi-fi', 'router', 'internet', 'network', 'modem', 'ethernet', 'bluetooth', 'signal'] },
  { id: 'electrical', label: 'Electrical', icon: Zap, keywords: ['breaker', 'fuse', 'socket', 'outlet', 'wiring', 'switch', 'light', 'circuit', 'generator', 'inverter', 'trips', 'tripping'] },
  { id: 'plumbing', label: 'Plumbing', icon: Droplets, keywords: ['leak', 'pipe', 'tap', 'faucet', 'toilet', 'pump', 'clog', 'sink'] },
  { id: 'other', label: 'Other', icon: Wrench, keywords: [] },
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
