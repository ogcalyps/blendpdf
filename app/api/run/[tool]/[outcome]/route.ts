import { isRunOutcome, isRunTool } from '@/lib/run-tools';

/**
 * The anonymous run counter for tools that run in the browser.
 *
 * A finished browser run sends `POST /api/run/<tool>/<ok|error>` (see
 * lib/analytics.ts). The answer is all this route does: nginx's access-log
 * line is the count, and the back office's nightly rollup reads it. The body
 * is never read, no cookie is set and nothing is stored or logged here.
 *
 * 204 for an allowlisted tool and outcome (lib/run-tools.ts), 404 for
 * anything else, so a scanner's guesses never look like runs in the logs.
 */
export const dynamic = 'force-dynamic';

export async function POST(_request: Request, context: { params: Promise<{ tool: string; outcome: string }> }) {
  const { tool, outcome } = await context.params;
  const status = isRunTool(tool) && isRunOutcome(outcome) ? 204 : 404;
  return new Response(null, { status, headers: { 'Cache-Control': 'no-store' } });
}
