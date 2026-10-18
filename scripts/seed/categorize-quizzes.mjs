#!/usr/bin/env node
/**
 * Deterministic category assignment for the QuizVerse catalogue.
 *
 * The catalogue was imported with every quiz under `culture`, which left 14 of
 * the 16 categories empty and made category pages impossible to browse. This
 * script maps each quiz to the category its subject actually belongs to, using
 * an ordered rule table: franchise names first (they are unambiguous), then
 * topics, then broad themes, and finally `culture` as the fallback.
 *
 *   node scripts/seed/categorize-quizzes.mjs                     # report only
 *   node scripts/seed/categorize-quizzes.mjs --write-sql         # also emit SQL
 *   node scripts/seed/categorize-quizzes.mjs --input <file>
 *
 * Input: JSON array exported from Postgres (see scripts/seed/README.md):
 *   [{ id, slug, title, tags[], quiz_type, language, category, excerpt }]
 *
 * Output:
 *   generated/audit/category-report.json     counts + sample per category
 *   generated/audit/category-assignments.sql idempotent UPDATE statements
 *
 * The rules are pure functions of the input, so re-running on the same export
 * always produces the same result.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_INPUT = join(ROOT, 'generated', 'audit', 'quizzes-export.json');
const OUTPUT_DIR = join(ROOT, 'generated', 'audit');

/**
 * Ordered rules. First match wins, so franchises come before topics and topics
 * before themes. `personality` and `culture` are intentionally last: one is a
 * quiz-type hub, the other is the generic bucket.
 */
const RULES = [
  {
    category: 'anime-manga',
    why: 'anime & manga franchises',
    patterns: [
      /\banime\b/,
      /\bmanga\b/,
      /\bshonen\b/,
      /\bwaifu\b/,
      /\bghibli\b/,
      /\battack on titan\b/,
      /\bshingeki\b/,
      /\bjujutsu kaisen\b/,
      /\bsolo leveling\b/,
      /\bwitch hat atelier\b/,
      /\bone piece\b/,
      /\bdemon slayer\b/,
      /\bkimetsu\b/,
      /\bclassroom of the elite\b/,
      /\bchainsaw man\b/,
      /\bfrieren\b/,
      /\bnaruto\b/,
      /\breincarnated as a slime\b/,
      /\bre:?\s?zero\b/,
      /\bdr\.?\s?stone\b/,
      /\bspy\s?x\s?family\b/,
      /\bmy hero academia\b/,
      /\btokyo ghoul\b/,
      /\bevangelion\b/,
      /\bsword art online\b/,
      /\bhunter x hunter\b/,
      /\bbleach\b/,
      /\bairbender\b/,
      /\bdragon ball\b/,
      /\bjojo\b/,
    ],
  },
  {
    category: 'gaming',
    why: 'video games and gaming culture',
    patterns: [
      /\bgaming\b/,
      /\bvideojuegos?\b/,
      /\bvideo ?game\b/,
      /\bgamer\b/,
      /\brpg\b/,
      /\bminecraft\b/,
      /\bgrand theft auto\b/,
      /\bgta\b/,
      /\bpok[eé]mon\b/,
      /\bresident evil\b/,
      /\b elden ring\b/,
      /\bstarfield\b/,
      /\bnintendo\b/,
      /\bbaldur'?s gate\b/,
      /\bhades (ii|2)\b/,
      /\bzelda\b/,
      /\bmario\b/,
      /\bfortnite\b/,
      /\bleague of legends\b/,
      /\bvalorant\b/,
      /\bcounter[- ]strike\b/,
      /\bcall of duty\b/,
      /\bwitcher\b/,
      /\bcyberpunk\b/,
      /\bamong us\b/,
      /\broblox\b/,
      /\bplaystation\b/,
      /\bxbox\b/,
      /\bsteam (deck|sale)\b/,
      /\bspeedrun\b/,
    ],
  },
  {
    category: 'movies-tv',
    why: 'films, series and streaming',
    patterns: [
      /\bnetflix\b/,
      /\bhbo\b/,
      /\bseries\b/,
      /\btv show\b/,
      /\bsitcom\b/,
      /\bmovie\b/,
      /\bfilm\b/,
      /\bpeli[cí]cula\b/,
      /\bcinema\b/,
      /\boscars?\b/,
      /\bthe bear\b/,
      /\bstar wars\b/,
      /\bhacks\b/,
      /\bwednesday\b/,
      /\bsquid game\b/,
      /\bstranger things\b/,
      /\bwicked\b/,
      /\bdune\b/,
      /\bspiderverse\b/,
      /\bspider[- ]?man\b/,
      /\bthe mummy\b/,
      /\beuphoria\b/,
      /\bwhite lotus\b/,
      /\bbridgerton\b/,
      /\binvincible\b/,
      /\bbarbie\b/,
      /\bseverance\b/,
      /\bthe boys\b/,
      /\boppenheimer\b/,
      /\bbeef\b/,
      /\bharry potter\b/,
      /\bthe last of us\b/,
      /\bmarvel\b/,
      /\bdc comics\b/,
      /\bbatman\b/,
      /\bsuperman\b/,
      /\bdisney\b/,
      /\bpixar\b/,
      /\bbreaking bad\b/,
      /\bgame of thrones\b/,
      /\bhouse of the dragon\b/,
      /\bfallout\b/,
      /\barcane\b/,
      /\bseason finale\b/,
      /\bstreaming\b/,
    ],
  },
  {
    category: 'music',
    why: 'artists, albums and music culture',
    patterns: [
      /\bk-?pop\b/,
      /\bm[uú]sica\b/,
      /\bmusic\b/,
      /\balbum\b/,
      /\bband\b/,
      /\bsinger\b/,
      /\bcantante\b/,
      /\bconcierto\b/,
      /\breggaeton\b/,
      /\breggaet[oó]n\b/,
      /\brock\b/,
      /\bgrammy\b/,
      /\bbillboard\b/,
      /\bspotify\b/,
      /\btrap\b/,
      /\bcumbia\b/,
      /\beras? musical\b/,
      /\bmusic festival\b/,
      /\bfestival de m[uú]sica\b/,
      /\bsabrina carpenter\b/,
      /\btaylor swift\b/,
      /\bchappell roan\b/,
      /\bbad bunny\b/,
      /\bbeyonc[eé]\b/,
      /\bvinyl\b/,
    ],
  },
  {
    category: 'literature',
    why: 'books, reading and authors',
    patterns: [
      /\bbooktok\b/,
      /\bbook\b/,
      /\blibro\b/,
      /\bnovela\b/,
      /\bnovel\b/,
      /\blectora\b/,
      /\breading\b/,
      /\bauthor\b/,
      /\bauthor\b/,
      /\bpoetry\b/,
      /\bpoes[ií]a\b/,
      /\bshakespeare\b/,
      /\bstephen king\b/,
      /\bbestseller\b/,
      /\bproject hail mary\b/,
      /\bc[oó]mic\b/,
      /\bgraphic novel\b/,
    ],
  },
  {
    category: 'science',
    why: 'science, space and nature facts',
    patterns: [
      /\bnasa\b/,
      /\bspace\b/,
      /\bespacio\b/,
      /\bmarte?\b/,
      /\bmars\b/,
      /\bastronom/,
      /\bphysics\b/,
      /\bf[ií]sica\b/,
      /\bchemistry\b/,
      /\bqu[ií]mica\b/,
      /\bbiology\b/,
      /\bbiolog[ií]a\b/,
      /\bclimate\b/,
      /\bclima\b/,
      /\bdinosaur/,
      /\bplanet\b/,
      /\bplaneta\b/,
      /\buniverse\b/,
      /\buniverso\b/,
      /\bscience\b/,
      /\bciencia\b/,
      /\bexperiment\b/,
      /\bexperimento\b/,
    ],
  },
  {
    category: 'history',
    why: 'historical events and eras',
    patterns: [
      /\bhistory\b/,
      /\bhistoria (universal|antigua|del mundo|de la humanidad)\b/,
      /\bwar\b/,
      /\bguerra\b/,
      /\bempire\b/,
      /\bimperio\b/,
      /\bancient\b/,
      /\bantigu[ao]\b/,
      /\brome\b/,
      /\broma\b/,
      /\begypt\b/,
      /\begipto\b/,
      /\brevolution\b/,
      /\brevoluci[oó]n\b/,
      /\bmedieval\b/,
      /\bnapole[oó]n\b/,
      /\bcold war\b/,
      /\bguerra fr[ií]a\b/,
    ],
  },
  {
    category: 'geography',
    why: 'countries, cities and maps',
    patterns: [
      /\bgeograph/,
      /\bgeograf[ií]a\b/,
      /\bcapital(es)?\b/,
      /\bcontinente?s?\b/,
      /\bmapa?s?\b/,
      /\bbandera?s?\b/,
      /\bcountries quiz\b/,
      /\bpaises quiz\b/,
    ],
  },
  {
    category: 'sports',
    why: 'sports and competitions',
    patterns: [
      /\bfootball\b/,
      /\bf[uú]tbol\b/,
      /\bsoccer\b/,
      /\bnba\b/,
      /\bnfl\b/,
      /\btennis\b/,
      /\btenis\b/,
      /\bolympic/,
      /\bolimpiada/,
      /\bformula 1\b/,
      /\bf1\b/,
      /\bboxeo\b/,
      /\bbaseball\b/,
      /\bb[eé]isbol\b/,
      /\bdeporte\b/,
      /\bsport\b/,
      /\bmessi\b/,
      /\bronaldo\b/,
      /\bufc\b/,
      /\bcricket\b/,
    ],
  },
  {
    category: 'food-drink',
    why: 'food, drink and cooking',
    patterns: [
      /\bcomida\b/,
      /\bfood\b/,
      /\bpizza\b/,
      /\bcoffee\b/,
      /\bcaf[eé]\b/,
      /\bdrink\b/,
      /\bbebida\b/,
      /\breceta\b/,
      /\brecipe\b/,
      /\bcuisine\b/,
      /\bcocina\b/,
      /\bsushi\b/,
      /\btaco\b/,
      /\bburger\b/,
      /\bhamburguesa\b/,
      /\bchocolate\b/,
      /\bwine\b/,
      /\bvino\b/,
      /\bbeer\b/,
      /\bcerveza\b/,
      /\bdessert\b/,
      /\bpostre\b/,
      /\brestaurant/,
      /\bchef\b/,
    ],
  },
  {
    category: 'technology',
    why: 'technology and the internet industry',
    patterns: [
      /\btecno?log[ií]a\b/,
      /\btechnology\b/,
      /\btech\b/,
      /\binteligencia artificial\b/,
      /\bai\b/,
      /\bia\b/,
      /\bprograma/,
      /\bc[oó]digo\b/,
      /\bsoftware\b/,
      /\bsmartphone\b/,
      /\bgadget\b/,
      /\bblockchain\b/,
      /\bcrypto\b/,
      /\bapp\b/,
      /\bstartup\b/,
      /\bdevelopers?\b/,
    ],
  },
  {
    category: 'animals',
    why: 'animals and pets',
    patterns: [
      /\banimals?\b/,
      /\banimales\b/,
      /\bdog\b/,
      /\bperro\b/,
      /\bcat\b/,
      /\bgato\b/,
      /\bwildlife\b/,
      /\bmascota\b/,
      /\bpet\b/,
      /\bzoo\b/,
      /\bbird\b/,
      /\bave\b/,
    ],
  },
  {
    category: 'relationships',
    why: 'dating, friendship and love',
    patterns: [
      /\brelationship\b/,
      /\bdating\b/,
      /\bcitas?\b/,
      /\blove life\b/,
      /\bamor\b/,
      /\bcrush\b/,
      /\bfriendship\b/,
      /\bamistad\b/,
      /\bpareja\b/,
      /\bbreakup\b/,
      /\bmatrimonio\b/,
      /\bnoviazgo\b/,
    ],
  },
  {
    category: 'pop-culture',
    why: 'internet, celebrity and fandom culture',
    patterns: [
      /\bpop culture\b/,
      /\bcultura pop\b/,
      /\bcelebrity\b/,
      /\bfamoso\b/,
      /\binternet\b/,
      /\bmeme\b/,
      /\bviral\b/,
      /\bnostalgia\b/,
      /\bfandom\b/,
      /\bsocial media\b/,
      /\bredes sociales\b/,
      /\binfluencer\b/,
      /\btiktok\b/,
      /\byoutube\b/,
      /\bstreamer\b/,
    ],
  },
  {
    category: 'lifestyle',
    why: 'routines, style and everyday life',
    patterns: [
      /\blifestyle\b/,
      /\bestilo de vida\b/,
      /\brutina\b/,
      /\broutine\b/,
      /\bfitness\b/,
      /\bhome\b/,
      /\bdecor\b/,
      /\bfashion\b/,
      /\bmoda\b/,
      /\btravel\b/,
      /\bviaje\b/,
      /\bvacation\b/,
      /\bvacaciones\b/,
      /\bwellness\b/,
      /\bh[aá]bitos\b/,
      /\bhabits\b/,
      /\bproductividad\b/,
      /\bproductivity\b/,
      /\bweekend\b/,
      /\bfin de semana\b/,
      /\bparty\b/,
      /\bfiesta\b/,
      /\bgift\b/,
      /\bregalo\b/,
      /\bwork\b/,
      /\btrabajo\b/,
    ],
  },
];

const FALLBACK_CATEGORY = 'culture';

/**
 * Evaluation order. Franchises are unambiguous, so they go first; broad themes go
 * last so a generic word ("story", "flag", "work") can never outrank a real topic.
 * A category missing from this list is never evaluated.
 */
const PRIORITY = [
  'anime-manga',
  'gaming',
  'movies-tv',
  'music',
  'literature',
  'food-drink',
  'relationships',
  'technology',
  'science',
  'history',
  'sports',
  'geography',
  'animals',
  'pop-culture',
  'lifestyle',
];

const ORDERED_RULES = [...RULES].sort(
  (left, right) => PRIORITY.indexOf(left.category) - PRIORITY.indexOf(right.category)
);

/** Lowercased haystack used for matching. */
function haystack(quiz) {
  return [quiz.title, quiz.excerpt, (quiz.tags ?? []).join(' ')].join(' ').toLowerCase();
}

/**
 * Picks the first rule that matches.
 * @returns {{ category: string, why: string }}
 */
export function classify(quiz) {
  const text = haystack(quiz);
  for (const rule of ORDERED_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      return { category: rule.category, why: rule.why };
    }
  }
  return { category: FALLBACK_CATEGORY, why: 'generic culture fallback' };
}

function escapeSql(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function buildSql(assignments) {
  const lines = [
    '-- Category assignment generated by scripts/seed/categorize-quizzes.mjs',
    '-- Apply with:',
    '--   docker exec -i supabase-db psql -U postgres -d postgres < category-assignments.sql',
    '-- (from the VPS, inside ~/quizverse/app-src)',
    'begin;',
  ];

  for (const [category, ids] of assignments) {
    // Chunked so a 500-id IN list stays readable.
    for (let index = 0; index < ids.length; index += 100) {
      const chunk = ids
        .slice(index, index + 100)
        .map(escapeSql)
        .join(', ');
      lines.push(
        `update public.quizzes set category_id = (select id from public.categories where slug = ${escapeSql(category)}) ` +
          `where id in (${chunk}) and category_id is distinct from ` +
          `(select id from public.categories where slug = ${escapeSql(category)});`
      );
    }
  }

  lines.push(
    '-- The update_category_quiz_count trigger keeps categories.quiz_count in sync.',
    'commit;'
  );
  return `${lines.join('\n')}\n`;
}

function main() {
  const args = process.argv.slice(2);
  const inputIndex = args.indexOf('--input');
  const inputPath = inputIndex !== -1 ? args[inputIndex + 1] : DEFAULT_INPUT;
  const writeSql = args.includes('--write-sql');

  const quizzes = JSON.parse(readFileSync(inputPath, 'utf8'));
  const byCategory = new Map();
  const assignments = new Map();
  const samples = new Map();

  for (const quiz of quizzes) {
    const { category, why } = classify(quiz);
    byCategory.set(category, (byCategory.get(category) ?? 0) + 1);
    if (!assignments.has(category)) assignments.set(category, []);
    assignments.get(category).push(quiz.id);
    if (!samples.has(category)) samples.set(category, []);
    if (samples.get(category).length < 5) {
      samples.get(category).push({ title: quiz.title, language: quiz.language, why });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    input: inputPath.replace(ROOT, '.'),
    total: quizzes.length,
    byCategory: Object.fromEntries([...byCategory.entries()].sort((a, b) => b[1] - a[1])),
    samples: Object.fromEntries(samples),
  };

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(join(OUTPUT_DIR, 'category-report.json'), `${JSON.stringify(report, null, 2)}\n`);

  if (writeSql) {
    writeFileSync(join(OUTPUT_DIR, 'category-assignments.sql'), buildSql(assignments));
  }

  console.log(`Classified ${quizzes.length} quizzes:`);
  for (const [category, count] of [...byCategory.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${category.padEnd(16)} ${String(count).padStart(4)}`);
  }
  console.log(`\nReport: generated/audit/category-report.json`);
  if (writeSql) console.log('SQL:    generated/audit/category-assignments.sql');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
