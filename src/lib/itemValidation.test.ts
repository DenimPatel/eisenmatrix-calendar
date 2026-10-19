import { describe, expect, it } from 'vitest';
import { coerceItemShape, validateItem } from './itemValidation';
import type { RecurrenceRule } from '@/types';

function shapeRule(input: unknown): RecurrenceRule | null {
  const validated = validateItem({ id: 'ov', kind: 'task', title: 'T', recurrence: input });
  if (!validated.ok) throw new Error(validated.reason);
  return validated.shape.recurrence;
}

describe('itemValidation occurrence overrides', () => {
  it('drops an override whose start is present but non-string', () => {
    expect(shapeRule({ freq: 'weekly', overrides: { k: { start: 5 } } })?.overrides).toEqual({});
  });

  it('drops an override whose end is present but non-string and non-null', () => {
    expect(shapeRule({ freq: 'weekly', overrides: { k: { end: 5 } } })?.overrides).toEqual({});
  });

  it('keeps an override whose end is explicitly null', () => {
    expect(shapeRule({ freq: 'weekly', overrides: { k: { end: null } } })?.overrides).toEqual({
      k: { end: null },
    });
  });

  it('drops an override with a non-boolean allDay', () => {
    expect(shapeRule({ freq: 'weekly', overrides: { k: { allDay: 'yes' } } })?.overrides).toEqual(
      {},
    );
  });

  it('drops an override with a non-string title or notes', () => {
    expect(shapeRule({ freq: 'weekly', overrides: { a: { title: 7 } } })?.overrides).toEqual({});
    expect(shapeRule({ freq: 'weekly', overrides: { b: { notes: [] } } })?.overrides).toEqual({});
  });

  it('drops an override with an unknown status', () => {
    expect(shapeRule({ freq: 'weekly', overrides: { k: { status: 'nope' } } })?.overrides).toEqual(
      {},
    );
  });

  it('keeps every valid field and drops unknown ones', () => {
    expect(
      shapeRule({
        freq: 'weekly',
        overrides: {
          k: {
            start: '2026-03-09',
            end: '2026-03-09T10:00',
            allDay: false,
            title: 'Moved',
            notes: 'note',
            status: 'doing',
            bogus: true,
          },
        },
      })?.overrides,
    ).toEqual({
      k: {
        start: '2026-03-09',
        end: '2026-03-09T10:00',
        allDay: false,
        title: 'Moved',
        notes: 'note',
        status: 'doing',
      },
    });
  });

  it('drops a non-object override entry and a non-object overrides map', () => {
    expect(shapeRule({ freq: 'weekly', overrides: { k: 5 } })?.overrides).toEqual({});
    expect(shapeRule({ freq: 'weekly', overrides: [1] })?.overrides).toEqual({});
    expect(coerceItemShape({ recurrence: { freq: 'weekly' } }).recurrence?.overrides).toEqual({});
  });
});
