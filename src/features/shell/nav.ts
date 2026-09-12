import type { LucideIcon } from 'lucide-react';
import {
  CalendarDays,
  LayoutGrid,
  ListChecks,
  Target,
  Flame,
  Receipt,
  ShoppingCart,
  StickyNote,
  Settings,
  Sun,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  shortcut: string;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/today', label: 'Today', icon: Sun, shortcut: '1' },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, shortcut: '2' },
  { to: '/matrix', label: 'Matrix', icon: LayoutGrid, shortcut: '3' },
  { to: '/lists', label: 'Lists', icon: ListChecks, shortcut: '4' },
  { to: '/goals', label: 'Goals', icon: Target, shortcut: '5' },
  { to: '/habits', label: 'Habits', icon: Flame, shortcut: '6' },
  { to: '/bills', label: 'Bills', icon: Receipt, shortcut: '7' },
  { to: '/shopping', label: 'Shopping', icon: ShoppingCart, shortcut: '8' },
  { to: '/notes', label: 'Notes', icon: StickyNote, shortcut: '9' },
  { to: '/settings', label: 'Settings', icon: Settings, shortcut: '' },
];
