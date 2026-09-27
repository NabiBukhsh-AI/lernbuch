/**
 * Dry run of the content contract — no database, CI friendly.
 *
 *   pnpm validate
 *
 * A GitHub Action runs this on every push so a malformed lesson file fails CI
 * before it can reach the database (Section 21).
 */
import './_env';
import { ContentValidationError, hasSlug, parseLesson } from '../src/lib/content/parser';
import { ContentDirError, contentDir, readLessonFiles } from '../src/lib/content/load';

async function main() {
  const dir = contentDir();
  console.log(`Validating lessons in ${dir}`);

  const files = await readLessonFiles(dir);
  if (files.length === 0) {
    console.log('No .md files found.');
    return;
  }

  let failures = 0;
  let checked = 0;

  for (const file of files) {
    if (!hasSlug(file.raw)) {
      console.log(`  ignored  ${file.fileName} (no slug)`);
      continue;
    }

    try {
      const parsed = parseLesson(file.fileName, file.raw);
      checked++;
      const counts = [
        `${parsed.sections.length} sections`,
        `${parsed.vocab.length} vocab`,
        `${parsed.grammar.length} grammar`,
        `${parsed.classwork.length} classwork`,
        `${parsed.homework.length} homework`,
        `${parsed.quizzes.length} quiz`,
        `${parsed.quizzes.reduce((n, q) => n + q.questions.length, 0)} questions`,
        `${parsed.errors.length} errors`,
      ].join(', ');
      console.log(`  ok       ${parsed.slug}  (${counts})`);
    } catch (error) {
      failures++;
      if (error instanceof ContentValidationError) {
        console.error(`  FAILED   ${error.file}`);
        for (const issue of error.issues) {
          console.error(`             ${issue.path}: ${issue.message}`);
        }
      } else {
        console.error(`  FAILED   ${file.fileName}`);
        console.error(error);
      }
    }
  }

  console.log(`\n${checked} valid, ${failures} failed.`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((error) => {
  if (error instanceof ContentDirError) console.error(error.message);
  else console.error(error);
  process.exitCode = 1;
});
