import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const RULE = '@typescript-eslint/no-explicit-any';

async function lint(source: string) {
  const eslint = new ESLint({ cwd: process.cwd() });
  const [result] = await eslint.lintText(source, { filePath: 'src/fixture.ts' });
  return result.messages.filter((message) => message.ruleId === RULE);
}

describe('eslint config', () => {
  it('enables no-explicit-any for TypeScript sources', async () => {
    const eslint = new ESLint({ cwd: process.cwd() });
    const config = await eslint.calculateConfigForFile('src/fixture.ts');
    expect(config.rules?.[RULE]?.[0]).toBeGreaterThan(0);
  });

  it('flags an explicit any', async () => {
    const messages = await lint('export const value: any = 1;\n');
    expect(messages).toHaveLength(1);
    expect(messages[0].severity).toBeGreaterThan(0);
  });

  it('leaves a typed declaration clean', async () => {
    const messages = await lint('export const value: number = 1;\n');
    expect(messages).toHaveLength(0);
  });
});
