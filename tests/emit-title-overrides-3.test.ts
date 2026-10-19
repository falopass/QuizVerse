import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// .test.ts and not .test.mjs on purpose: vitest's include only covers
// tests/**/*.test.ts(x), so an .mjs file is never discovered by
// `npx vitest run` or `npm test`. (Batch 1 used node --test instead.)
const SCRIPT = join(__dirname, '..', 'scripts', 'seed', 'emit-title-overrides-3.mjs');
const SEED = join(__dirname, '..', 'scripts', 'seed', 'quiz-title-overrides-3.json');

interface Override {
  slug: string;
  title: string;
}

function loadBatch(): Override[] {
  return JSON.parse(readFileSync(SEED, 'utf8')).quizzes;
}

function runScript(payload: { quizzes?: Override[] }, extraArgs: string[] = []) {
  const dir = mkdtempSync(join(tmpdir(), 'title-overrides-3-'));
  const fixture = join(dir, 'overrides.json');
  writeFileSync(fixture, JSON.stringify(payload));
  try {
    const stdout = execFileSync('node', [SCRIPT, '--input', fixture, ...extraArgs], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, stdout, stderr: '' };
  } catch (error) {
    const err = error as { status?: number; stdout?: string; stderr?: string };
    return {
      status: err.status ?? -1,
      stdout: err.stdout ?? '',
      stderr: err.stderr ?? '',
    };
  }
}

function batchWith(mutate: (quizzes: Override[]) => void) {
  const quizzes = loadBatch();
  mutate(quizzes);
  return { quizzes };
}

describe('emit-title-overrides-3', () => {
  it('emite un UPDATE idempotente por cada uno de los 110 slugs del lote', () => {
    const { status, stdout } = runScript({ quizzes: loadBatch() });
    expect(status).toBe(0);
    expect(stdout.match(/^UPDATE public\.quizzes$/gm)).toHaveLength(110);
    expect(stdout.match(/updated_at = now\(\)/g)).toHaveLength(110);
    expect(stdout.match(/^WHERE slug = '/gm)).toHaveLength(110);
    expect(stdout).toMatch(/^begin;/m);
    expect(stdout).toMatch(/^commit;/m);
  });

  it('cada UPDATE solo toca filas cuyo título vivo sigue siendo el del molde', () => {
    const { status, stdout } = runScript({ quizzes: loadBatch() });
    expect(status).toBe(0);
    expect(stdout.match(/^  AND title = '/gm)).toHaveLength(110);
    expect(stdout).toMatch(/AND title = 'Which The Boys energy matches you best\?'/);
    expect(stdout).toMatch(/AND title = '¿Qué energía de Dune combina mejor contigo\?'/);
  });

  it('escapa comillas simples en los títulos', () => {
    const { status, stdout } = runScript({ quizzes: loadBatch() });
    expect(status).toBe(0);
    expect(stdout).toMatch(/title = 'Baldur''s Gate 3/);
  });

  it('--check sale 0 con el lote real', () => {
    const stdout = execFileSync('node', [SCRIPT, '--check'], { encoding: 'utf8' });
    expect(stdout).toMatch(/Validated 110 title overrides/);
  });

  it('rechaza un slug fuera del lote', () => {
    const { status, stderr } = runScript(
      batchWith((quizzes) => {
        quizzes[0] = { slug: 'en-not-in-the-batch', title: quizzes[0].title };
      })
    );
    expect(status).toBe(1);
    expect(stderr).toMatch(/slug is not in the batch list/);
  });

  it('rechaza la plantilla vieja en inglés y en español', () => {
    for (const template of [
      'Which The Boys energy matches you best',
      '¿Qué energía de The Boys combina mejor contigo?',
    ]) {
      const { status, stderr } = runScript(
        batchWith((quizzes) => {
          quizzes[0] = { ...quizzes[0], title: template };
        })
      );
      expect(status).toBe(1);
      expect(stderr).toMatch(/old template/);
    }
  });

  it('rechaza títulos fuera del rango 30-65', () => {
    for (const title of ['Too short', 'x'.repeat(66)]) {
      const { status, stderr } = runScript(
        batchWith((quizzes) => {
          quizzes[0] = { ...quizzes[0], title };
        })
      );
      expect(status).toBe(1);
      expect(stderr).toMatch(/30-65 characters/);
    }
  });

  it('rechaza títulos repetidos', () => {
    const { status, stderr } = runScript(
      batchWith((quizzes) => {
        quizzes[1] = { ...quizzes[1], title: quizzes[0].title };
      })
    );
    expect(status).toBe(1);
    expect(stderr).toMatch(/duplicate title/);
  });

  it('rechaza un lote incompleto', () => {
    const { status, stderr } = runScript(batchWith((quizzes) => quizzes.splice(0, 1)));
    expect(status).toBe(1);
    expect(stderr).toMatch(/missing override/);
  });

  it('rechaza un JSON sin lista "quizzes" con contenido', () => {
    const { status, stderr } = runScript({});
    expect(status).toBe(1);
    expect(stderr).toMatch(/"quizzes" must be a nonempty array/);
  });
});
