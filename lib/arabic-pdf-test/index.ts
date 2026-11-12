/**
 * "Can your PDF editor handle Arabic?" (/arabic-pdf-editor-test). Server-only
 * content, like lib/upload-limits: the tasks come from the checker's own
 * cases.json, so the page and the download can't disagree. English only for
 * now; other locales show the English page, noindexed with an English canonical.
 */
import cases from '@/scripts/arabic-pdf-test/cases.json';
import type { TaskResult, TestFile, TestSetText, TestTask } from './types';
import { text as en } from './en';
import results from './results.json';
import zip from './zip.json';

export type { CheckId, CheckStatus, TaskResult, TestFile, TestSetText, TestTask } from './types';

export const TEST_SET_PATH = '/arabic-pdf-editor-test';
export const TEST_SET_LOCALES = ['en'] as const;

export const FILES: readonly TestFile[] = cases.files;
export const TASKS = cases.tasks as readonly TestTask[];
export const RESULTS = results.tasks as readonly TaskResult[];
export const TESTED = results.tested;
export const PUBLISHED = cases.published;
export const ZIP = { href: `${TEST_SET_PATH}/${zip.file}`, bytes: zip.bytes };

export function testSetText(locale: string): TestSetText {
  void locale;
  return en;
}

/** "01" for 01-chrome-times-new-roman.pdf. */
export const fileNumber = (file: string) => file.slice(0, 2);

export const fileHref = (file: string) => `${TEST_SET_PATH}/${file}`;

export const tasksOf = (file: string) => TASKS.filter((t) => t.file === file);

export const resultOf = (task: string) => RESULTS.find((r) => r.task === task);

/** "585 KB": what the download button says. */
export const sizeLabel = (bytes: number) => `${Math.round(bytes / 1024)} KB`;
