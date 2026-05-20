import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const sourcePath = path.join(rootDir, 'generated', 'trending-seed-openrouter.json');
const reportPath = path.join(rootDir, 'generated', 'cover-assets-report.json');

function main() {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Seed file not found: ${sourcePath}`);
  }

  const quizzes = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  const report = {
    total: quizzes.length,
    withCoverUrl: quizzes.filter(
      (quiz) =>
        typeof quiz.cover_image_url === 'string' && quiz.cover_image_url.startsWith('/covers/')
    ).length,
    sample: quizzes
      .slice(0, 12)
      .map((quiz) => ({ slug: quiz.slug, cover_image_url: quiz.cover_image_url })),
    note: 'Cover assets are now served dynamically via /covers/[slug] route.',
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

main();
