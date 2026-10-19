import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(ROOT, 'scripts', 'seed', 'emit-title-overrides-5.mjs');
const SEED = join(ROOT, 'scripts', 'seed', 'quiz-title-overrides-5.json');

function loadBatch() {
  return JSON.parse(readFileSync(SEED, 'utf8')).quizzes;
}

function runScript(payload, extraArgs = []) {
  const dir = mkdtempSync(join(tmpdir(), 'title-overrides-5-'));
  const fixture = join(dir, 'overrides.json');
  writeFileSync(fixture, JSON.stringify(payload));
  try {
    const stdout = execFileSync('node', [SCRIPT, '--input', fixture, ...extraArgs], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, stdout, stderr: '' };
  } catch (error) {
    return {
      status: error.status ?? -1,
      stdout: error.stdout ?? '',
      stderr: error.stderr ?? '',
    };
  }
}

function batchWith(mutate) {
  const quizzes = loadBatch();
  mutate(quizzes);
  return { quizzes };
}

describe('emit-title-overrides-5', () => {
  it('emite un UPDATE idempotente por cada uno de los 110 slugs del lote', () => {
    const { status, stdout } = runScript({ quizzes: loadBatch() });
    expect(status).toBe(0);
    expect((stdout.match(/^UPDATE public\.quizzes$/gm) ?? []).length).toBe(110);
    expect((stdout.match(/updated_at = now\(\)/g) ?? []).length).toBe(110);
    expect((stdout.match(/^WHERE slug = '/gm) ?? []).length).toBe(110);
    expect((stdout.match(/^  AND title = '/gm) ?? []).length).toBe(110);
    expect(stdout).toMatch(/^begin;/m);
    expect(stdout).toMatch(/^commit;/m);
  });

  it('predica el título vigente para no pisar ediciones en vivo', () => {
    const { status, stdout } = runScript({ quizzes: loadBatch() });
    expect(status).toBe(0);
    expect(stdout).toMatch(
      /WHERE slug = 'en-how-deep-does-your-attack-on-titan-knowledge-go'\n  AND title = 'How deep does your Attack on Titan knowledge go\?';/
    );
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

  it('rechaza un slug sin prefijo de idioma', () => {
    const { status, stderr } = runScript(
      batchWith((quizzes) => {
        quizzes[0] = { slug: 'xx-dune-knowledge-go', title: quizzes[0].title };
      })
    );
    expect(status).toBe(1);
    expect(stderr).toMatch(/language prefix/);
  });

  it('rechaza la plantilla vieja en inglés y en español', () => {
    for (const template of [
      'How deep does your Dune knowledge go?',
      '¿Qué tan profundo llega tu conocimiento de Dune?',
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
