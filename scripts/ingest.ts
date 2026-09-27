/**
 * Parse, validate and upsert every lesson file in CONTENT_DIR.
 *
 *   pnpm ingest          skip files whose hash is unchanged
 *   pnpm ingest:force    re-upsert regardless of hash
 *
 * The admin panel's lesson upload does the same thing for a single file. A
 * validation failure aborts that file only, prints the YAML path and the
 * reason, and the run exits 1 so CI can gate it.
 */
// Must stay first: loads .env.local before db/client.ts reads DATABASE_URL.
import './_env';
import { db, pool } from '../src/db/client';
import {
  describeFailure,
  formatStats,
  ingestLessonFile,
} from '../src/lib/content/ingest';
import { ContentDirError, contentDir, readLessonFiles } from '../src/lib/content/load';

const force = process.argv.includes('--force');

type Row = { lesson: string; action: string; detail: string };

function printTable(rows: Row[]): void {
  const widths = [
    Math.max(6, ...rows.map((r) => r.lesson.length)),
    Math.max(6, ...rows.map((r) => r.action.length)),
  ];
  const line = (a: string, b: string, c: string) =>
    `${a.padEnd(widths[0]!)}  ${b.padEnd(widths[1]!)}  ${c}`;

  console.log('');
  console.log(line('LESSON', 'ACTION', 'CHANGES'));
  console.log(line('-'.repeat(widths[0]!), '-'.repeat(widths[1]!), '-'.repeat(20)));
  for (const row of rows) console.log(line(row.lesson, row.action, row.detail));
  console.log('');
}

async function main() {
  const dir = contentDir();
  console.log(`Reading lessons from ${dir}${force ? '  (--force)' : ''}`);

  const files = await readLessonFiles(dir);
  if (files.length === 0) {
    console.log('No .md files found. Nothing to do.');
    return;
  }

  const rows: Row[] = [];
  let failures = 0;

  for (const file of files) {
    const outcome = await ingestLessonFile(db, file.fileName, file.raw, { force });

    if (outcome.action === 'failed') {
      failures++;
      console.error(`\nFailed: ${file.fileName}\n${describeFailure(outcome.error)}`);
      rows.push({ lesson: outcome.lesson, action: 'failed', detail: 'see above' });
    } else if ('stats' in outcome) {
      rows.push({
        lesson: outcome.lesson,
        action: outcome.action,
        detail: formatStats(outcome.stats),
      });
    } else {
      rows.push({
        lesson: outcome.lesson,
        action: outcome.action,
        detail: outcome.detail,
      });
    }
  }

  printTable(rows);

  if (failures > 0) {
    console.error(`${failures} file(s) failed validation.`);
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    if (error instanceof ContentDirError) console.error(error.message);
    else console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
