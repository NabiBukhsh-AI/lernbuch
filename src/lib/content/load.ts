/**
 * Locating and reading lesson files — ARCHITECTURE.md Section 6.1.
 *
 * CONTENT_DIR decides where lessons are read from. It defaults to
 * ./content/lessons; point it wherever your lesson repo is checked out. Paths
 * resolve from the repo root, and a missing folder fails with a clear message
 * rather than an empty run that looks like success.
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

export const DEFAULT_CONTENT_DIR = './content/lessons';

export function contentDir(): string {
  const configured = process.env.CONTENT_DIR?.trim() || DEFAULT_CONTENT_DIR;
  return path.resolve(process.cwd(), configured);
}

export class ContentDirError extends Error {}

export type LessonFile = { fileName: string; filePath: string; raw: string };

export async function readLessonFiles(dir = contentDir()): Promise<LessonFile[]> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    throw new ContentDirError(
      `Lesson directory not found: ${dir}\n` +
        `Set CONTENT_DIR in .env.local to the folder holding your lesson .md files.`,
    );
  }

  const files = entries.filter((name) => name.toLowerCase().endsWith('.md')).sort();

  return Promise.all(
    files.map(async (fileName) => ({
      fileName,
      filePath: path.join(dir, fileName),
      raw: await readFile(path.join(dir, fileName), 'utf8'),
    })),
  );
}
