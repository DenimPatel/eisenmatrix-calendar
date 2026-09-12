import {
  CalendarDays,
  CheckSquare,
  Flame,
  Receipt,
  ShoppingCart,
  StickyNote,
  Target,
  type LucideIcon,
} from 'lucide-react';
import type { ItemKind } from '@/types';

export interface KindMeta {
  icon: LucideIcon;
  label: string;
  token: string;
}

export const KIND_META: Record<ItemKind, KindMeta> = {
  task: { icon: CheckSquare, label: 'Task', token: 'accent' },
  event: { icon: CalendarDays, label: 'Event', token: 'q2' },
  habit: { icon: Flame, label: 'Habit', token: 'q3' },
  goal: { icon: Target, label: 'Goal', token: 'q1' },
  bill: { icon: Receipt, label: 'Bill', token: 'q1' },
  shopping: { icon: ShoppingCart, label: 'Shopping', token: 'q2' },
  note: { icon: StickyNote, label: 'Note', token: 'q4' },
};
