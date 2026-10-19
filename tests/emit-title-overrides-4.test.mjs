import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(
  fileURLToPath(import.meta.url),
  '..',
  '..',
  'scripts',
  'seed',
  'emit-title-overrides-4.mjs'
);

function runEmitter(extraArgs = [], payload = null) {
  const args = [...extraArgs];
  if (payload) {
    const dir = mkdtempSync(join(tmpdir(), 'title-overrides-4-'));
    const fixture = join(dir, 'overrides.json');
    writeFileSync(fixture, JSON.stringify(payload));
    args.push('--input', fixture);
  }
  try {
    const stdout = execFileSync('node', [SCRIPT, ...args], {
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

describe('emit-title-overrides-4', () => {
  it('emite un UPDATE por cada uno de los 98 overrides reales', () => {
    const { status, stdout } = runEmitter();
    expect(status).toBe(0);
    expect(stdout.match(/UPDATE public\.quizzes/g)).toHaveLength(98);
    // stdout stays pure SQL so it can be piped into psql; the summary goes to stderr.
    expect(stdout).not.toContain('Validated');
  });

  it('imprime el resumen de validación con --check', () => {
    const { status, stdout } = runEmitter(['--check']);
    expect(status).toBe(0);
    expect(stdout).toContain('Validated: 98 title overrides');
  });

  it('condiciona cada UPDATE al título viejo del molde', () => {
    const { status, stdout } = runEmitter();
    expect(status).toBe(0);
    expect(stdout).toContain(
      "WHERE slug = 'en-what-role-would-you-play-inside-the-boys' AND title = 'What role would you play inside The Boys?'"
    );
  });

  it('falla con un título de menos de 30 caracteres', () => {
    const { status, stderr } = runEmitter(
      [],
      [{ slug: 'en-what-role-would-you-play-inside-the-boys', title: 'The Boys: Too Short' }]
    );
    expect(status).toBe(1);
    expect(stderr).toContain('30–65 characters');
  });

  it('falla con un título de 66 caracteres o más', () => {
    const { status, stderr } = runEmitter(
      [],
      [
        {
          slug: 'en-what-role-would-you-play-inside-the-boys',
          title: 'The Boys: Which Side of the Supes Fight Fits You the Absolute Most?',
        },
      ]
    );
    expect(status).toBe(1);
    expect(stderr).toContain('30–65 characters');
  });

  it('falla si el título nuevo sigue usando el molde viejo', () => {
    const { status, stderr } = runEmitter(
      [],
      [
        {
          slug: 'en-what-role-would-you-play-inside-the-boys',
          title: 'What role would you play inside The Boys?',
        },
      ]
    );
    expect(status).toBe(1);
    expect(stderr).toContain('old mold');
  });

  it('falla con un slug fuera de la lista cerrada', () => {
    const { status, stderr } = runEmitter(
      [],
      [{ slug: 'en-not-in-the-closed-list', title: 'A Perfectly Valid Title of Decent Length' }]
    );
    expect(status).toBe(1);
    expect(stderr).toContain('not in the closed override list');
  });
});
