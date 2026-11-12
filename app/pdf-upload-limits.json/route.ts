import { limitsJson } from '@/lib/upload-limits';

// The /pdf-upload-limits table as JSON (CC BY 4.0), built from the same rows as the page.
export const dynamic = 'force-static';

export function GET() {
  return Response.json(limitsJson());
}
