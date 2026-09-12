import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Clock, Repeat } from 'lucide-react';
import type { Item, ItemStatus } from '@/types';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/Badge';
import { KIND_META } from './kindMeta';
import { ITEM_STATUS_LABELS } from '@/lib/labels';
import { describeRecurrence } from '@/domain/quickadd';
import { formatTime } from '@/lib/date';
import { toggleDone } from '@/domain/itemActions';

export interface ItemCardProps {
  item: Item;
  occurrenceKey?: string | null;
  status?: ItemStatus;
  compact?: boolean;
  showKind?: boolean;
  showStatus?: boolean;
  showMeta?: boolean;
  dragDisabled?: boolean;
  className?: string;
  onEdit?: (item: Item, occurrenceKey?: string | null) => void;
}

export function ItemCard({
  item,
  occurrenceKey = null,
  status,
  compact,
  showKind = false,
  showStatus = false,
  showMeta = true,
  dragDisabled = false,
  className,
  onEdit,
}: ItemCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: occurrenceKey ? `${item.id}:${occurrenceKey}` : item.id,
    data: { dragType: 'item', item, occurrenceKey },
    disabled: dragDisabled,
  });

  const effectiveStatus =
    status ?? (occurrenceKey ? (item.occurrences[occurrenceKey]?.status ?? 'todo') : item.status);
  const done = effectiveStatus === 'done';
  const kind = KIND_META[item.kind];
  const time = formatTime(item.start);
  const recurrenceLabel = describeRecurrence(item.recurrence);

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative rounded-lg border border-border bg-surface p-2.5 text-left shadow-sm transition-shadow hover:shadow-md',
        done && 'opacity-70',
        isDragging && 'z-50 opacity-0',
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          aria-label={done ? 'Mark as not done' : 'Mark as done'}
          onClick={(e) => {
            e.stopPropagation();
            void toggleDone(item, occurrenceKey);
          }}
          className={cn(
            'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors',
            done
              ? 'border-emerald-500 bg-emerald-500 text-white'
              : 'border-border hover:border-accent',
          )}
        >
          {done && (
            <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 fill-none stroke-current stroke-[2]">
              <path d="M2 6l3 3 5-6" />
            </svg>
          )}
        </button>

        <button
          type="button"
          className="min-w-0 flex-1 cursor-pointer text-left"
          onClick={() => {
            if (!isDragging) onEdit?.(item, occurrenceKey);
          }}
          {...listeners}
          {...attributes}
        >
          <div className="flex items-center gap-1.5">
            {showKind && <kind.icon size={12} className="shrink-0 text-muted" />}
            <span
              className={cn(
                'min-w-0 flex-1 truncate text-sm font-medium text-fg',
                done && 'text-muted line-through',
              )}
            >
              {item.title || 'Untitled'}
            </span>
          </div>

          {showMeta && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {time && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted">
                  <Clock size={10} /> {time}
                </span>
              )}
              {recurrenceLabel && !compact && (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted">
                  <Repeat size={10} /> {recurrenceLabel}
                </span>
              )}
              {item.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} tone="muted" className="px-1.5 py-0 text-[10px]">
                  #{tag}
                </Badge>
              ))}
              {showStatus && (
                <Badge tone={done ? 'success' : 'default'} className="px-1.5 py-0 text-[10px]">
                  {ITEM_STATUS_LABELS[effectiveStatus]}
                </Badge>
              )}
            </div>
          )}
        </button>
      </div>
    </div>
  );
}
