import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const SCRIPT = join(process.cwd(), 'scripts', 'seo', 'check-page-metadata.mjs');
const REPO_ROOT = process.cwd();

const WITH_METADATA = `export function generateMetadata() {
  return { title: 'x' };
}
export default function Page() {
  return null;
}
`;

const WITHOUT_METADATA = `export default function Page() {
  return null;
}
`;

const PRIVATE_NOINDEX = `export const metadata = { robots: { index: false }, other: 'noindex' };
export default function Page() {
  return null;
}
`;

function run(root: string): { status: number; stdout: string } {
  try {
    const stdout = execFileSync('node', [SCRIPT, '--root', root], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, stdout };
  } catch (error) {
    const err = error as { status: number; stdout: string };
    return { status: err.status, stdout: err.stdout };
  }
}

function writePage(root: string, rel: string, content: string) {
  const dir = join(root, 'src', 'app', ...rel.split('/').slice(0, -1));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'page.tsx'), content);
}

const fixture = mkdtempSync(join(tmpdir(), 'seo-guard-'));
afterAll(() => rmSync(fixture, { recursive: true, force: true }));

function buildFixture(pages: Record<string, string>): string {
  const root = mkdtempSync(join(fixture, 'case-'));
  for (const [rel, content] of Object.entries(pages)) writePage(root, rel, content);
  return root;
}

describe('seo:guard — check-page-metadata', () => {
  it('página con generateMetadata pasa', () => {
    const root = buildFixture({ '[locale]/about/page.tsx': WITH_METADATA });
    const { status, stdout } = run(root);
    expect(status).toBe(0);
    expect(stdout).toContain('RESULTADO: 1 páginas revisadas, 0 problemas');
  });

  it('página sin metadata falla', () => {
    const root = buildFixture({ '[locale]/about/page.tsx': WITHOUT_METADATA });
    const { status, stdout } = run(root);
    expect(status).toBe(1);
    expect(stdout).toContain('src/app/[locale]/about/page.tsx: sin metadata propia');
    expect(stdout).toContain('RESULTADO: 1 páginas revisadas, 1 problemas');
  });

  it('login sin noindex falla', () => {
    const root = buildFixture({ '[locale]/login/page.tsx': WITH_METADATA });
    const { status, stdout } = run(root);
    expect(status).toBe(1);
    expect(stdout).toContain('src/app/[locale]/login/page.tsx: ruta privada sin noindex');
  });

  it('login con noindex pasa', () => {
    const root = buildFixture({ '[locale]/login/page.tsx': PRIVATE_NOINDEX });
    const { status, stdout } = run(root);
    expect(status).toBe(0);
    expect(stdout).toContain('RESULTADO: 1 páginas revisadas, 0 problemas');
  });

  it.each(['settings', 'notifications', 'forgot-password', 'reset-password'])(
    '%s sin noindex falla',
    (prefix) => {
      const root = buildFixture({ [`[locale]/${prefix}/page.tsx`]: WITH_METADATA });
      const { status, stdout } = run(root);
      expect(status).toBe(1);
      expect(stdout).toContain(`src/app/[locale]/${prefix}/page.tsx: ruta privada sin noindex`);
    }
  );

  it('el repo real pasa el guard (nace verde)', () => {
    const { status, stdout } = run(REPO_ROOT);
    expect(stdout).toContain('RESULTADO:');
    expect(status).toBe(0);
  });
});
