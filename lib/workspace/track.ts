/**
 * Analytics for one workspace save (workspace-spec.md 8.2): one run per
 * browser operation the save performs, named after that operation (crop_pdf,
 * watermark_pdf...), so the run counter sends one /api/run/<run>/<outcome>
 * beacon each and GA carries the page the visitor is on. Server steps are
 * tracked by the api-client helpers they go through, not here.
 *
 * savePlanParams gives the editor's save_plan event (what the visitor asked
 * the save for) its params.
 */
import { currentToolFromPath, trackToolComplete, trackToolError, trackToolStart } from '@/lib/analytics';
import { effectivePlan } from './summary';
import type { SavePlan, SaveStep } from './types';

export interface SaveTracking {
  complete(): void;
  error(error: unknown, step: SaveStep): void;
}

/** Fires tool_process_start for each op now; complete() or error() ends them all. */
export function trackClientOps(ops: readonly string[]): SaveTracking {
  const meta = { processing_method: 'client', page_slug: currentToolFromPath() };
  const started = Date.now();
  for (const op of ops) trackToolStart(op, meta);
  return {
    complete() {
      const ms = Date.now() - started;
      for (const op of ops) trackToolComplete(op, ms, meta);
    },
    error(error, step) {
      const ms = Date.now() - started;
      for (const op of ops) trackToolError(op, error, ms, { ...meta, error_code: step });
    },
  };
}

/** save_plan's option names (lowercase letters only: lib/events.ts), each with whether a plan has it on. */
const PLAN_OPTIONS: readonly (readonly [string, (plan: SavePlan) => boolean])[] = [
  ['also', (plan) => plan.alsoSelected],
  ['compress', (plan) => plan.compress !== null],
  ['flatten', (plan) => plan.flatten],
  ['metadata', (plan) => plan.removeMetadata],
  ['password', (plan) => plan.password !== null],
  ['selected', (plan) => plan.pages === 'selected'],
  ['split', (plan) => plan.split.kind !== 'none'],
];

/**
 * save_plan's params for a save that starts: the format, the options that are
 * on as a sorted comma list (left out when none) and the doc's page count.
 * Read through effectivePlan, so they say what the save does (a PDF-only
 * choice left over on a Word save is not on). Never the password itself.
 */
export function savePlanParams(plan: SavePlan, pageCount: number): { format: string; options?: string; page_count: number } {
  const effective = effectivePlan(plan);
  const on = PLAN_OPTIONS.filter(([, isOn]) => isOn(effective)).map(([name]) => name).sort();
  return { format: effective.format, ...(on.length > 0 ? { options: on.join(',') } : {}), page_count: pageCount };
}
