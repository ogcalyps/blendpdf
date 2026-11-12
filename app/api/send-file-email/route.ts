import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/cloudwatch-logger';
import { emailLogRef, fileLogMeta } from '@/lib/log-redact';
import { rateLimitMiddleware } from '@/lib/rate-limit';
import {
  FileTooLargeForEmailError,
  getSesFileEmailConfig,
  sendFileEmailViaSes,
  sendTrustpilotInviteTrigger,
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
    // The email goes out in the language of the page the user was on
    const locale = body.locale === 'ar' || body.locale === 'fr' || body.locale === 'es' ? body.locale : 'en';
    // Route slug of the tool page; sendFileEmailViaSes ignores anything it doesn't know
    const tool = typeof body.tool === 'string' ? body.tool : undefined;

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
    // Never the address or the filename itself: the filename is built from the
    // visitor's upload, and SES errors quote the address back.
    const logMeta = {
      emailRef: emailLogRef(String(email)),
      ...fileLogMeta({ name: String(filename), size: Math.floor((String(fileData).length * 3) / 4) }),
    };

    if (!ses.configured) {
      logger.warn(
        '[Send File Email] SES not configured (set AWS_SES_FROM_EMAIL and AWS_REGION or AWS_SES_REGION)',
        { ...logMeta, nodeEnv: process.env.NODE_ENV },
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
        locale,
        tool,
      });
    } catch (sendErr: unknown) {
      if (sendErr instanceof FileTooLargeForEmailError) {
        return NextResponse.json(
          { error: sendErr.message, requestId }, // leak-guard: authored — FileTooLargeForEmailError carries our copy
          { status: 413 }
        );
      }
      // The name (MessageRejected, Throttling, ...) and status say what went
      // wrong; the message is left out because SES quotes the recipient in it.
      logger.error('[Send File Email] SES send failed', {
        errorName: sendErr instanceof Error ? sendErr.name : typeof sendErr,
        httpStatus: (sendErr as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode,
        ...logMeta,
      }, requestId);
      return NextResponse.json(
        {
          error: 'Could not send email. Try downloading the file, or try again later.',
          requestId,
        },
        { status: 502 }
      );
    }

    logger.info('[Send File Email] Sent via SES', logMeta, requestId);

    // The user already has their file, so a failed trigger only costs one review invitation
    try {
      await sendTrustpilotInviteTrigger(email, locale);
    } catch (err: unknown) {
      logger.warn('[Send File Email] Trustpilot invite trigger failed', {
        errorName: err instanceof Error ? err.name : typeof err,
        ...logMeta,
      }, requestId);
    }

    return NextResponse.json(
      { success: true, message: 'Email sent successfully', requestId },
      { status: 200 }
    );

  } catch (error: any) {
    logger.error('[Send File Email] Error', { error: error?.message, stack: error?.stack }, requestId);
    return NextResponse.json(
      {
        error: 'Failed to send the email. Please try again.',
        errorCode: 'EMAIL_FAILED',
        requestId,
      },
      { status: 500 }
    );
  }
}
