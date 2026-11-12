import { decodeEvent } from '@/lib/events';

/**
 * First-party usage events (lib/events.ts, sent by lib/analytics.ts
 * sendEvent): `POST /api/ev?<query>`. The answer is all this route does:
 * nginx's access-log line is the record, and the back office's rollup reads
 * it. The body is never read, no cookie is set and nothing is stored or
 * logged here.
 *
 * 204 for a query decodeEvent accepts (exactly what encodeEvent sends), 404
 * for anything else, so a scanner's guesses never look like events in the logs.
 */
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const status = decodeEvent(new URL(request.url).search) ? 204 : 404;
  return new Response(null, { status, headers: { 'Cache-Control': 'no-store' } });
}
