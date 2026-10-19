import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');
const SCRIPT = join(ROOT, 'scripts', 'seed', 'emit-neutral-spanish.mjs');
const OVERRIDES_PATH = join(ROOT, 'scripts', 'seed', 'neutral-spanish-overrides.json');
const SEED_PATHS = [
  join(ROOT, 'generated', 'trending-seed.json'),
  join(ROOT, 'generated', 'trending-seed.normalized.json'),
];

// Same marker list used to flag the catalogue: corrected prose must stay clean.
// Character-class boundaries instead of \b (which treats accented letters as
// non-word): "Poné a prueba" matches, "mostrándoles" or "nuevos" do not.
// "estás"/"elegí" se excluyen igual que en el emisor: son español neutro válido.
const VOSEO_RE =
  /(?<![a-záéíóúñü])(poné|sos|tenés|querés|mirá|sabés|podés|debés|usás|vivís|jugás|sentís|decís|vení|hacé|andá|creés|pensás|vos)(?![a-záéíóúñü])/i;

interface Option {
  id?: string;
  text?: string;
  is_correct?: boolean;
  personality_tags?: string[];
}

interface Question {
  id?: string;
  question?: string;
  explanation?: string | null;
  options?: Option[];
  [key: string]: unknown;
}

interface SeedQuiz {
  slug: string;
  title?: string;
  description?: string;
  questions?: Question[];
}

interface Override {
  title?: string;
  description?: string;
  questions?: Question[];
}

const overrides = JSON.parse(readFileSync(OVERRIDES_PATH, 'utf8')) as Record<string, Override>;

/** First seed containing the slug wins, same lookup order as the emitter. */
function sourceQuiz(slug: string): SeedQuiz | undefined {
  for (const seedPath of SEED_PATHS) {
    const list = JSON.parse(readFileSync(seedPath, 'utf8')) as SeedQuiz[];
    const found = list.find((quiz) => quiz.slug === slug);
    if (found) return found;
  }
  return undefined;
}

/** Answer-key surface: ids, option counts, is_correct flags and tags. */
function structureOf(questions: Question[] = []) {
  return questions.map((question) => ({
    ...Object.fromEntries(
      Object.entries(question).filter(
        ([key]) => key !== 'question' && key !== 'explanation' && key !== 'options'
      )
    ),
    options: (question.options ?? []).map((option) =>
      Object.fromEntries(Object.entries(option).filter(([key]) => key !== 'text'))
    ),
  }));
}

function correctedText(override: Override) {
  const chunks = [override.title, override.description];
  for (const question of override.questions ?? []) {
    chunks.push(question.question ?? undefined, question.explanation ?? undefined);
    for (const option of question.options ?? []) chunks.push(option.text);
  }
  return chunks.filter((chunk): chunk is string => typeof chunk === 'string').join('\n');
}

function runEmitter(args: string[]) {
  try {
    const stdout = execFileSync('node', [SCRIPT, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, stdout, stderr: '' };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return {
      status: failure.status ?? -1,
      stdout: failure.stdout ?? '',
      stderr: failure.stderr ?? '',
    };
  }
}

describe('neutral-spanish overrides', () => {
  it('todo slug de los overrides existe en algún seed fuente', () => {
    for (const slug of Object.keys(overrides)) {
      expect(sourceQuiz(slug), slug).toBeDefined();
    }
  });

  it('los overrides corrigen texto que sí tenía voseo', () => {
    for (const [slug, override] of Object.entries(overrides)) {
      const source = sourceQuiz(slug);
      expect(source).toBeDefined();
      const originalText = correctedText({
        title: override.title !== undefined ? source?.title : undefined,
        description: override.description !== undefined ? source?.description : undefined,
        questions: override.questions !== undefined ? source?.questions : undefined,
      });
      expect(VOSEO_RE.test(originalText), slug).toBe(true);
    }
  });

  it('el texto corregido ya no matchea la regex de voseo', () => {
    for (const [slug, override] of Object.entries(overrides)) {
      expect(VOSEO_RE.test(correctedText(override)), slug).toBe(false);
    }
  });

  it('los overrides de questions conservan ids e is_correct idénticos', () => {
    for (const [slug, override] of Object.entries(overrides)) {
      if (override.questions === undefined) continue;
      const source = sourceQuiz(slug);
      expect(source?.questions).toBeDefined();
      expect(structureOf(override.questions), slug).toEqual(structureOf(source!.questions));
    }
  });

  it('el SQL tiene exactamente un UPDATE por slug y ningún delete/insert/alter', () => {
    const { status, stdout } = runEmitter([]);
    expect(status).toBe(0);
    const slugs = Object.keys(overrides);
    const updates = stdout.match(/update public\.quizzes/gi) ?? [];
    expect(updates).toHaveLength(slugs.length);
    for (const slug of slugs) {
      const matches = stdout.match(new RegExp(`where slug = '${slug}'`, 'g')) ?? [];
      expect(matches, slug).toHaveLength(1);
    }
    expect(stdout).not.toMatch(/\b(delete|insert|alter)\b/i);
    expect(stdout).toContain('begin;');
    expect(stdout).toContain('commit;');
  });

  it('cada UPDATE solo aplica si la fila viva sigue igual al seed (`is not distinct from`)', () => {
    const { status, stdout } = runEmitter([]);
    expect(status).toBe(0);
    const statements = stdout.split('update public.quizzes').slice(1);
    expect(statements).toHaveLength(Object.keys(overrides).length);
    for (const statement of statements) {
      expect(statement).toContain('is not distinct from');
    }
  });

  it('el emisor falla con exit 1 si un slug no existe en los seeds', () => {
    const dir = mkdtempSync(join(tmpdir(), 'neutral-spanish-'));
    const fixture = join(dir, 'overrides.json');
    writeFileSync(
      fixture,
      JSON.stringify({ 'es-slug-inexistente': { description: 'Texto corregido.' } })
    );
    const { status, stderr } = runEmitter(['--input', fixture]);
    expect(status).toBe(1);
    expect(stderr).toContain('es-slug-inexistente');
  });

  it('el emisor falla con exit 1 ante un slug duplicado en el JSON', () => {
    const dir = mkdtempSync(join(tmpdir(), 'neutral-spanish-'));
    const fixture = join(dir, 'overrides.json');
    writeFileSync(
      fixture,
      '{"es-trivia-fan-de-hacks":{"description":"Primera."},"es-trivia-fan-de-hacks":{"description":"Segunda."}}'
    );
    const { status, stderr } = runEmitter(['--input', fixture]);
    expect(status).toBe(1);
    expect(stderr).toContain('duplicate slugs');
    expect(stderr).toContain('es-trivia-fan-de-hacks');
  });

  it('emite texto con «tú estás» / «yo elegí», español neutro válido', () => {
    const dir = mkdtempSync(join(tmpdir(), 'neutral-spanish-'));
    const fixture = join(dir, 'overrides.json');
    writeFileSync(
      fixture,
      JSON.stringify({
        'es-trivia-fan-de-hacks': {
          description:
            'Cuando tú estás frente a la pantalla y yo elegí otro capítulo, ¿quién manda?',
        },
      })
    );
    const { status, stdout, stderr } = runEmitter(['--input', fixture]);
    expect(stderr).toBe('');
    expect(status).toBe(0);
    expect(stdout).toContain("where slug = 'es-trivia-fan-de-hacks'");
  });

  it('sigue rechazando voseo real como «tenés que»', () => {
    const dir = mkdtempSync(join(tmpdir(), 'neutral-spanish-'));
    const fixture = join(dir, 'overrides.json');
    writeFileSync(
      fixture,
      JSON.stringify({
        'es-trivia-fan-de-hacks': {
          description: 'Tenés que ver esta serie para entender cada referencia.',
        },
      })
    );
    const { status, stderr } = runEmitter(['--input', fixture]);
    expect(status).toBe(1);
    expect(stderr).toContain('voseo regex');
  });
});
