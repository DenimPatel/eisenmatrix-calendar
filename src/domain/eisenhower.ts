import type { Item, Priority } from '@/types';

export type QuadrantId = 'q1' | 'q2' | 'q3' | 'q4';

export interface QuadrantMeta {
  id: QuadrantId;
  title: string;
  subtitle: string;
  urgency: Priority;
  importance: Priority;
  token: string;
}

export const QUADRANTS: Record<QuadrantId, QuadrantMeta> = {
  q1: {
    id: 'q1',
    title: 'Do First',
    subtitle: 'Urgent & important',
    urgency: 'high',
    importance: 'high',
    token: 'q1',
  },
  q2: {
    id: 'q2',
    title: 'Schedule',
    subtitle: 'Important, not urgent',
    urgency: 'low',
    importance: 'high',
    token: 'q2',
  },
  q3: {
    id: 'q3',
    title: 'Delegate',
    subtitle: 'Urgent, not important',
    urgency: 'high',
    importance: 'low',
    token: 'q3',
  },
  q4: {
    id: 'q4',
    title: 'Eliminate',
    subtitle: 'Neither urgent nor important',
    urgency: 'low',
    importance: 'low',
    token: 'q4',
  },
};

export const QUADRANT_IDS: QuadrantId[] = ['q1', 'q2', 'q3', 'q4'];

export function quadrantOf(item: Pick<Item, 'urgency' | 'importance'>): QuadrantId {
  if (item.importance === 'high') return item.urgency === 'high' ? 'q1' : 'q2';
  return item.urgency === 'high' ? 'q3' : 'q4';
}

/** 4 = important+urgent … 1 = neither. */
export function priorityScore(item: Pick<Item, 'urgency' | 'importance'>): number {
  return (item.importance === 'high' ? 2 : 0) + (item.urgency === 'high' ? 1 : 0);
}

export function itemsInQuadrant(items: Item[], quadrant: QuadrantId): Item[] {
  return items.filter((item) => quadrantOf(item) === quadrant);
}
