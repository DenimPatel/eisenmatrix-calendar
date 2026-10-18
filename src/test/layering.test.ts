import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function source(relative: string): string {
  return readFileSync(path.join(process.cwd(), relative), 'utf8');
}

describe('layering', () => {
  it('keeps the db migration free of the UI store and the toast reporter', () => {
    const migration = source('src/db/migrations/legacyTasks.ts');

    expect(migration).not.toMatch(/@\/store\b/);
    expect(migration).not.toMatch(/from '@\/lib\/reportFailure'/);
  });

  it('keeps the pure failure tracer free of the store', () => {
    expect(source('src/lib/failureTrace.ts')).not.toMatch(/@\/store\b/);
  });
});
