import { limitsCsv } from '@/lib/upload-limits';

// The /pdf-upload-limits table as CSV (CC BY 4.0), built from the same rows as the page.
export const dynamic = 'force-static';

export function GET() {
  return new Response(limitsCsv(), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'inline; filename="pdf-upload-limits.csv"',
    },
  });
}
