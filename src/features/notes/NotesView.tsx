import { useMemo, useState } from 'react';
import { Pin, Plus, StickyNote } from 'lucide-react';
import { useItems } from '@/hooks/useData';
import { useUiStore } from '@/store/useUiStore';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { createItem } from '@/domain/itemFactory';
import { createItemPersisted, patchItem } from '@/domain/itemActions';
import { cn } from '@/lib/cn';
import type { Item } from '@/types';

export function NotesView() {
  const items = useItems();
  const openEditor = useUiStore((s) => s.openEditor);
  const [draft, setDraft] = useState('');

  const notes = useMemo(
    () =>
      items
        .filter((i) => i.kind === 'note' && !i.archivedAt)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [items],
  );
  const pinned = notes.filter((n) => (n as Item & { kind: 'note' }).data.pinned);
  const rest = notes.filter((n) => !(n as Item & { kind: 'note' }).data.pinned);

  const addNote = async () => {
    const text = draft.trim();
    if (!text) return;
    const [firstLine, ...restLines] = text.split('\n');
    await createItemPersisted(
      createItem({ kind: 'note', title: firstLine.slice(0, 80), notes: restLines.join('\n') }),
    );
    setDraft('');
  };

  const togglePin = async (note: Item) => {
    if (note.kind !== 'note') return;
    await patchItem(
      note.id,
      { data: { ...note.data, pinned: !note.data.pinned } },
      { silent: true, trackHistory: false },
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-fg">Notes</h1>
          <p className="text-sm text-muted">Quick capture and reference.</p>
        </div>
      </div>

      <div className="card space-y-2 p-3">
        <textarea
          className="input min-h-[72px]"
          placeholder="Jot something down… (first line becomes the title)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void addNote();
          }}
        />
        <div className="flex justify-end">
          <Button
            variant="primary"
            size="sm"
            onClick={() => void addNote()}
            disabled={!draft.trim()}
          >
            <Plus size={14} /> Add note
          </Button>
        </div>
      </div>

      {notes.length === 0 ? (
        <EmptyState
          icon={<StickyNote size={20} />}
          title="No notes yet"
          description="Capture a thought above, or pin important notes to the top."
        />
      ) : (
        <div className="space-y-4">
          {pinned.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Pinned
              </h2>
              <NoteGrid notes={pinned} onOpen={openEditor} onPin={togglePin} />
            </section>
          )}
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              All notes
            </h2>
            <NoteGrid notes={rest} onOpen={openEditor} onPin={togglePin} />
          </section>
        </div>
      )}
    </div>
  );
}

function NoteGrid({
  notes,
  onOpen,
  onPin,
}: {
  notes: Item[];
  onOpen: (item: Item) => void;
  onPin: (item: Item) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {notes.map((note) => (
        <div key={note.id} className="card group flex flex-col p-3">
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              onClick={() => onOpen(note)}
              className="min-w-0 flex-1 text-left text-sm font-semibold text-fg hover:text-accent"
            >
              {note.title || 'Untitled note'}
            </button>
            <button
              type="button"
              onClick={() => onPin(note)}
              aria-label="Toggle pin"
              className={cn(
                'rounded p-1 text-muted hover:text-accent',
                (note as Item & { kind: 'note' }).data.pinned && 'text-accent',
              )}
            >
              <Pin size={14} />
            </button>
          </div>
          {note.notes && (
            <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-xs text-muted">{note.notes}</p>
          )}
          {note.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {note.tags.map((tag) => (
                <span key={tag} className="text-[10px] text-muted">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
