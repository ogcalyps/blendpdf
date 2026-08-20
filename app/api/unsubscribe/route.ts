import { NextRequest, NextResponse } from 'next/server';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { getDynamoDBClient, getEmailsTableName } from '@/lib/dynamodb-client';
import { verifyUnsubscribeSig, normalizeEmail } from '@/lib/unsubscribe';
import { logger } from '@/lib/cloudwatch-logger';

export const runtime = 'nodejs';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Minimal self-contained bilingual (English + Arabic) confirmation page.
 * This route lives outside the [locale] tree and is opened from email links,
 * so it renders both languages inline instead of using next-intl.
 */
function htmlPage(params: {
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
  status: number;
}): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(params.titleEn)} — BlendPDF</title>
</head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <div style="max-width:480px;margin:64px auto;padding:32px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;">
    <p style="margin:0 0 24px;font-size:18px;font-weight:700;color:#111827;">BlendPDF</p>
    <div dir="ltr" style="margin-bottom:24px;">
      <h1 style="margin:0 0 8px;font-size:20px;color:#111827;">${params.titleEn}</h1>
      <p style="margin:0;font-size:15px;line-height:1.6;color:#374151;">${params.bodyEn}</p>
    </div>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
    <div dir="rtl" lang="ar">
      <h1 style="margin:0 0 8px;font-size:20px;color:#111827;">${params.titleAr}</h1>
      <p style="margin:0;font-size:15px;line-height:1.6;color:#374151;">${params.bodyAr}</p>
    </div>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status: params.status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

/**
 * API Route: Unsubscribe an email address
 *
 * GET /api/unsubscribe?email=...&sig=...
 * sig is HMAC-SHA256(email) — see lib/unsubscribe.ts. On a valid signature the
 * DynamoDB record is marked unsubscribed=true with an unsubscribedAt timestamp.
 */
export async function GET(request: NextRequest) {
  const requestId = `unsubscribe-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email') || '';
  const sig = searchParams.get('sig') || '';

  if (!email || !sig || !verifyUnsubscribeSig(email, sig)) {
    logger.warn('[Unsubscribe] Invalid or missing signature', { hasEmail: !!email, hasSig: !!sig }, requestId);
    return htmlPage({
      titleEn: 'Invalid unsubscribe link',
      titleAr: 'رابط إلغاء الاشتراك غير صالح',
      bodyEn: 'This unsubscribe link is invalid or has expired. Please use the link from the most recent email we sent you.',
      bodyAr: 'رابط إلغاء الاشتراك هذا غير صالح أو انتهت صلاحيته. يرجى استخدام الرابط الموجود في أحدث رسالة بريد إلكتروني أرسلناها إليك.',
      status: 400,
    });
  }

  const normalizedEmail = normalizeEmail(email);
  const safeEmail = escapeHtml(normalizedEmail);

  try {
    const client = getDynamoDBClient();
    const tableName = getEmailsTableName();

    await client.send(new UpdateCommand({
      TableName: tableName,
      Key: { email: normalizedEmail },
      UpdateExpression: 'SET unsubscribed = :unsubscribed, unsubscribedAt = :unsubscribedAt',
      ExpressionAttributeValues: {
        ':unsubscribed': true,
        ':unsubscribedAt': new Date().toISOString(),
      },
    }));

    logger.info('[Unsubscribe] Email unsubscribed', { email: normalizedEmail }, requestId);
  } catch (error: any) {
    const isDev = process.env.NODE_ENV === 'development' || !process.env.AWS_REGION;

    if (isDev) {
      // Match the subscribe route's DEV fallback: log and continue so the flow
      // can be tested without AWS.
      logger.warn('[Unsubscribe] DEV MODE - DynamoDB not available, unsubscribe logged only', { email: normalizedEmail, error: error.message }, requestId);
    } else {
      logger.error('[Unsubscribe] Failed to update DynamoDB record', { email: normalizedEmail, error: error.message }, requestId);
      return htmlPage({
        titleEn: 'Something went wrong',
        titleAr: 'حدث خطأ ما',
        bodyEn: 'We could not process your unsubscribe request right now. Please try again later.',
        bodyAr: 'تعذّرت معالجة طلب إلغاء الاشتراك في الوقت الحالي. يرجى المحاولة مرة أخرى لاحقًا.',
        status: 500,
      });
    }
  }

  return htmlPage({
    titleEn: 'You have been unsubscribed',
    titleAr: 'تم إلغاء اشتراكك',
    bodyEn: `${safeEmail} will no longer receive emails from BlendPDF.`,
    bodyAr: `لن يتلقى ${safeEmail} أي رسائل بريد إلكتروني من BlendPDF بعد الآن.`,
    status: 200,
  });
}
