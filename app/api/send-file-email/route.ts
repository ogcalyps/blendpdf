import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/cloudwatch-logger';
import { rateLimitMiddleware } from '@/lib/rate-limit';
import {
  FileTooLargeForEmailError,
  getSesFileEmailConfig,
  sendFileEmailViaSes,
} from '@/lib/send-file-email-ses';

/**
 * API Route: Send file via email
 * 
 * Sends the processed file to the user's email address.
 * Uses AWS SES or similar email service.
 */
export async function POST(request: NextRequest) {
  const requestId = `send-email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Rate limiting: 10 emails per 15 minutes per IP
  const rateLimit = rateLimitMiddleware(request, {
    windowMs: 15 * 60 * 1000,
    maxRequests: 10,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: 'Too many email requests. Please wait a few minutes before trying again.',
        requestId,
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': String(rateLimit.remaining),
          'Retry-After': String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)),
        },
      }
    );
  }

  try {
    const body = await request.json();
    const { email, filename, fileData, fileType } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required', requestId },
        { status: 400 }
      );
    }

    if (!fileData || !filename) {
      return NextResponse.json(
        { error: 'File data and filename are required', requestId },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format', requestId },
        { status: 400 }
      );
    }

    const ses = getSesFileEmailConfig();

    if (!ses.configured) {
      logger.warn(
        '[Send File Email] SES not configured (set AWS_SES_FROM_EMAIL and AWS_REGION or AWS_SES_REGION)',
        { email, filename, nodeEnv: process.env.NODE_ENV },
        requestId
      );

      return NextResponse.json(
        {
          error:
            process.env.NODE_ENV === 'development'
              ? 'Email is not configured on this dev server. Add AWS_SES_FROM_EMAIL and AWS_REGION to .env.local (verified SES identity), or use Download.'
              : 'Email delivery is not configured. Please download the file directly.',
          requestId,
        },
        { status: 503 }
      );
    }

    try {
      await sendFileEmailViaSes({
        to: email,
        filename,
        fileType: fileType || 'application/pdf',
        fileDataBase64: fileData,
      });
    } catch (sendErr: unknown) {
      if (sendErr instanceof FileTooLargeForEmailError) {
        return NextResponse.json(
          { error: sendErr.message, requestId },
          { status: 413 }
        );
      }
      const msg = sendErr instanceof Error ? sendErr.message : String(sendErr);
      logger.error('[Send File Email] SES send failed', { error: msg, email, filename }, requestId);
      return NextResponse.json(
        {
          error: 'Could not send email. Try downloading the file, or try again later.',
          requestId,
        },
        { status: 502 }
      );
    }

    logger.info('[Send File Email] Sent via SES', { email, filename }, requestId);

    return NextResponse.json(
      { success: true, message: 'Email sent successfully', requestId },
      { status: 200 }
    );

  } catch (error: any) {
    logger.error('[Send File Email] Error', { error: error.message }, requestId);
    return NextResponse.json(
      {
        error: error.message || 'Failed to send email',
        requestId,
      },
      { status: 500 }
    );
  }
}
