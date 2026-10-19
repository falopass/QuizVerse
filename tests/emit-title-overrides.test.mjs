// Runs under `node --test`. Vitest does not discover *.test.mjs (its include
// only covers .test.ts/.test.tsx), so this file is a plain Node test on purpose.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(ROOT, 'scripts', 'seed', 'emit-title-overrides.mjs');
const SEED = join(ROOT, 'scripts', 'seed', 'quiz-title-overrides.json');

function loadBatch() {
  return JSON.parse(readFileSync(SEED, 'utf8')).quizzes;
}

function runScript(payload, extraArgs = []) {
  const dir = mkdtempSync(join(tmpdir(), 'title-overrides-'));
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

describe('emit-title-overrides', () => {
  it('emite un UPDATE idempotente por cada uno de los 40 slugs del lote', () => {
    const { status, stdout } = runScript({ quizzes: loadBatch() });
    assert.equal(status, 0);
    assert.equal((stdout.match(/^UPDATE public\.quizzes$/gm) ?? []).length, 40);
    assert.equal((stdout.match(/updated_at = now\(\)/g) ?? []).length, 40);
    assert.equal((stdout.match(/^WHERE slug = '/gm) ?? []).length, 40);
    assert.match(stdout, /^begin;/m);
    assert.match(stdout, /^commit;/m);
  });

  it('escapa comillas simples en los títulos', () => {
    const { status, stdout } = runScript({ quizzes: loadBatch() });
    assert.equal(status, 0);
    assert.match(stdout, /title = 'Baldur''s Gate 3/);
  });

  it('--check sale 0 con el lote real', () => {
    const stdout = execFileSync('node', [SCRIPT, '--check'], { encoding: 'utf8' });
    assert.match(stdout, /Validated 40 title overrides/);
  });

  it('rechaza un slug fuera del lote', () => {
    const { status, stderr } = runScript(
      batchWith((quizzes) => {
        quizzes[0] = { slug: 'en-not-in-the-batch', title: quizzes[0].title };
      })
    );
    assert.equal(status, 1);
    assert.match(stderr, /slug is not in the batch list/);
  });

  it('rechaza un slug sin prefijo de idioma', () => {
    const { status, stderr } = runScript(
      batchWith((quizzes) => {
        quizzes[0] = { slug: 'xx-dune-fan-trivia-challenge', title: quizzes[0].title };
      })
    );
    assert.equal(status, 1);
    assert.match(stderr, /language prefix/);
  });

  it('rechaza la plantilla vieja en inglés y en español', () => {
    for (const template of ['Dune Fan Trivia Challenge', 'Trivia fan de Dune']) {
      const { status, stderr } = runScript(
        batchWith((quizzes) => {
          quizzes[0] = { ...quizzes[0], title: template };
        })
      );
      assert.equal(status, 1, template);
      assert.match(stderr, /old template/);
    }
  });

  it('rechaza títulos fuera del rango 30-65', () => {
    for (const title of ['Too short', 'x'.repeat(66)]) {
      const { status, stderr } = runScript(
        batchWith((quizzes) => {
          quizzes[0] = { ...quizzes[0], title };
        })
      );
      assert.equal(status, 1, title.slice(0, 30));
      assert.match(stderr, /30-65 characters/);
    }
  });

  it('rechaza títulos repetidos', () => {
    const { status, stderr } = runScript(
      batchWith((quizzes) => {
        quizzes[1] = { ...quizzes[1], title: quizzes[0].title };
      })
    );
    assert.equal(status, 1);
    assert.match(stderr, /duplicate title/);
  });

  it('rechaza un lote incompleto', () => {
    const { status, stderr } = runScript(batchWith((quizzes) => quizzes.splice(0, 1)));
    assert.equal(status, 1);
    assert.match(stderr, /missing override/);
  });

  it('rechaza un JSON sin lista "quizzes" con contenido', () => {
    const { status, stderr } = runScript({});
    assert.equal(status, 1);
    assert.match(stderr, /"quizzes" must be a nonempty array/);
  });
});
