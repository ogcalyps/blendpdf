/**
 * The open workspace, carried across a language switch.
 *
 * Switching language is a client-side navigation to the same page under
 * another locale, but the [locale] segment changes, so the tool page mounts
 * again and the visitor's file and edits were gone. LanguageSwitcher calls
 * stashForLocaleSwitch just before it navigates; the tool page under the new
 * locale picks the work up (peekCarryOver) and lets it go once it has mounted.
 *
 * Held in this module's memory only, like lib/file-handoff: nothing is written
 * to browser storage or uploaded, and a reload loses it.
 */
import type { EditorState } from '@/components/edit-pdf/state';
import type { WorkspaceMode } from './types';
import { toolSlugFromPath } from '@/lib/keep-working';

export interface CarryOver {
  /** Page slug it was taken on ('rotate-pdf'): only that page under another locale picks it up. */
  slug: string;
  mode: WorkspaceMode;
  /** What the visitor chose (ToolWorkspace's files). */
  files: readonly File[];
  /** The editor as it was, when it was open: the working file (after a fix or Insert PDF) and its state. */
  editor: { workingFile: File; state: EditorState } | null;
}

type Getter<T> = () => T;

let workspace: Getter<{ mode: WorkspaceMode; files: readonly File[] } | null> | null = null;
let editor: Getter<CarryOver['editor']> | null = null;
let carried: CarryOver | null = null;

/** ToolWorkspace, while it is mounted. Returns the unregister. */
export function registerWorkspace(get: NonNullable<typeof workspace>): () => void {
  workspace = get;
  return () => {
    if (workspace === get) workspace = null;
  };
}

/** The Editor, while it is mounted. Returns the unregister. */
export function registerEditor(get: NonNullable<typeof editor>): () => void {
  editor = get;
  return () => {
    if (editor === get) editor = null;
  };
}

/** Just before a language switch on `pathname`: keep the open work, if any. */
export function stashForLocaleSwitch(pathname: string): void {
  const open = workspace?.() ?? null;
  carried = open && open.files.length > 0 ? { slug: toolSlugFromPath(pathname), ...open, editor: editor?.() ?? null } : null;
}

/** The carried work for this page and mode, without taking it (render may run twice). */
export function peekCarryOver(pathname: string, mode: WorkspaceMode): CarryOver | null {
  return carried && carried.slug === toolSlugFromPath(pathname) && carried.mode === mode ? carried : null;
}

/** Let it go once the page has it, or when it was for another page. */
export function clearCarryOver(): void {
  carried = null;
}
