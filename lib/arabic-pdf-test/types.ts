/**
 * "Can your PDF editor handle Arabic?" (/arabic-pdf-editor-test): test PDFs,
 * tasks and a checker anyone can rerun, with BlendPDF's own results. The
 * tasks and files are in scripts/arabic-pdf-test/cases.json, the results in
 * ./results.json (both made by scripts/arabic-pdf-test/build.mjs).
 */

export type CheckId = 'search' | 'copy' | 'order' | 'letters' | 'harakat' | 'removed' | 'kept';
export type CheckStatus = 'pass' | 'fail' | 'n/a';

export interface TestFile {
  file: string;
  madeWith: string;
  font: string;
  /** The true text of each line, in reading order. */
  lines: string[];
}

export type TestTask = { id: string; file: string } & ({ do: 'change'; from: string; to: string } | { do: 'add'; text: string });

/** What the checker found on the file BlendPDF saved for one task. */
export interface TaskResult {
  task: string;
  /** Under /arabic-pdf-editor-test/; none when nothing was saved. */
  file?: string;
  /** The line's box opened empty: the editor couldn't read the line. */
  emptyBox?: boolean;
  /** BlendPDF's own words when it wouldn't make the change. */
  refused?: string;
  checks?: { id: CheckId; status: CheckStatus; detail: string }[];
  notes?: string[];
}

/** The page's words in one language. Text may mark code in `backticks`. */
export interface TestSetText {
  metaTitle: string;
  description: string;
  title: string;
  intro: string;
  home: string;
  download: { zip: (size: string) => string; contents: string };
  summary: { title: string; tested: string; items: string[] };
  run: { title: string; steps: string[]; command: string; after: string };
  checks: { title: string; intro: string; items: Record<CheckId, { label: string; text: string }>; notCovered: string; lamAlef: string };
  files: {
    title: string;
    intro: string;
    madeWith: string;
    font: string;
    open: string;
    /** What makes each file hard, by its number ('01'). */
    hard: Record<string, string>;
    change: [string, string];
    add: [string, string];
    blendpdf: string;
    saved: string;
    refused: string;
    status: Record<'pass' | 'fail', string>;
    /** Plain words for every task that didn't pass everything. */
    notes: Record<string, string>;
  };
  others: {
    title: string;
    intro: string;
    items: { name: string; path: string; task: string; text: string }[];
    after: string;
    all: string;
  };
  why: { title: string; paragraphs: string[] };
  reuse: { title: string; text: string; citation: string; copy: string; copied: string };
  correction: { before: string; after: string };
  faq: { question: string; answer: string }[];
}
