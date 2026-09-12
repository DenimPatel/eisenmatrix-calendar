import type { Item } from '@/types';
import type { QuadrantId } from '@/domain/eisenhower';

export interface ItemDragData {
  dragType: 'item';
  item: Item;
  occurrenceKey?: string | null;
}

export interface QuadrantDropData {
  dropType: 'quadrant';
  quadrantId: QuadrantId;
}

export interface DayDropData {
  dropType: 'day';
  dateKey: string;
}

export interface ListDropData {
  dropType: 'list';
  listId: string;
}

export type DropData = QuadrantDropData | DayDropData | ListDropData;

export function isItemDrag(data: unknown): data is ItemDragData {
  return !!data && (data as ItemDragData).dragType === 'item';
}
