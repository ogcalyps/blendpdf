import { NextRequest, NextResponse } from 'next/server';
import { PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { getDynamoDBClient, getEmailsTableName } from '@/lib/dynamodb-client';
import { rateLimitMiddleware, getClientIP } from '@/lib/rate-limit';
import { emailLogRef } from '@/lib/log-redact';

/**
 * API Route: Subscribe user email
 *
 * Stores user email in DynamoDB for marketing campaigns and Trustpilot review requests.
 */
export async function POST(request: NextRequest) {
  // Rate limiting: 5 subscriptions per 15 minutes per IP (protects the
  // DynamoDB table from junk-address flooding)
  const rateLimit = rateLimitMiddleware(request, {
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
  });

  if (!rateLimit.allowed) {
    console.warn(`[Email Capture] Rate limit exceeded for IP: ${getClientIP(request)}`);
    return NextResponse.json(
      { error: 'Too many requests. Please try again in a few minutes.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': '5',
          'X-RateLimit-Remaining': String(rateLimit.remaining),
          'Retry-After': String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)),
        },
      }
    );
  }

  try {
    const body = await request.json();
    const { email } = body;
    // Picks the language of the one-time review request (lib/backoffice/review-requests.ts)
    const locale = body.locale === 'ar' || body.locale === 'fr' || body.locale === 'es' ? body.locale : 'en';

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Normalize email (lowercase)
    const normalizedEmail = email.toLowerCase().trim();

    // Store email in DynamoDB (with fallback for DEV)
    try {
      const client = getDynamoDBClient();
      const tableName = getEmailsTableName();

      try {
        await client.send(new PutCommand({
          TableName: tableName,
          Item: {
            email: normalizedEmail,
            source: 'download-capture',
            createdAt: new Date().toISOString(),
            unsubscribed: false,
            reviewRequestSent: false,
            locale,
            // TTL (optional): Automatically delete after 2 years if you want
            // expiresAt: Math.floor(Date.now() / 1000) + (2 * 365 * 24 * 60 * 60),
          },
          // Prevent duplicates - if email already exists, update it instead
          ConditionExpression: 'attribute_not_exists(email)',
        }));

        console.log('[Email Capture] Stored new email in DynamoDB:', emailLogRef(normalizedEmail));
      } catch (error: any) {
        // If email already exists (ConditionalCheckFailedException), that's okay
        // Just update the record to refresh the timestamp. reviewRequestSent is
        // left alone, so signing up again never brings a second review request.
        if (error.name === 'ConditionalCheckFailedException') {
          const now = new Date().toISOString();
          await client.send(new UpdateCommand({
            TableName: tableName,
            Key: { email: normalizedEmail },
            UpdateExpression: 'SET #s = :s, createdAt = :now, updatedAt = :now, unsubscribed = :f, #l = :l REMOVE unsubscribedAt',
            ExpressionAttributeNames: { '#s': 'source', '#l': 'locale' },
            ExpressionAttributeValues: { ':s': 'download-capture', ':now': now, ':f': false, ':l': locale },
          }));
          console.log('[Email Capture] Email already exists, updated timestamp:', emailLogRef(normalizedEmail));
        } else {
          // Re-throw other errors
          throw error;
        }
      }
    } catch (dynamoError: any) {
      // Fallback for DEV: If DynamoDB is not available, just log a marker for the email
      // This allows the feature to work in DEV without AWS setup
      const isDev = process.env.NODE_ENV === 'development' || !process.env.AWS_REGION;
      
      if (isDev) {
        console.log('[Email Capture] DEV MODE - DynamoDB not available, email not stored:', emailLogRef(normalizedEmail));
        console.log('[Email Capture] Record would be stored:', {
          source: 'download-capture',
          createdAt: new Date().toISOString(),
          unsubscribed: false,
          reviewRequestSent: false,
        });
        // In DEV, we still return success so the UI flow continues
      } else {
        // In production, re-throw the error
        throw dynamoError;
      }
    }

    return NextResponse.json(
      { success: true, message: 'Email subscribed successfully' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[Email Capture] Error:', error);
    
    // In DEV mode, if DynamoDB fails, still return success (email was logged)
    const isDev = process.env.NODE_ENV === 'development' || !process.env.AWS_REGION;
    
    if (isDev && (error.name === 'ResourceNotFoundException' || 
                  error.name === 'UnrecognizedClientException' ||
                  error.message?.includes('credentials') ||
                  error.message?.includes('DynamoDB'))) {
      console.log('[Email Capture] DEV MODE - DynamoDB error ignored, returning success');
      return NextResponse.json(
        { success: true, message: 'Email subscribed successfully (DEV mode - logged to console)' },
        { status: 200 }
      );
    }
    
    // Don't expose internal DynamoDB errors to client in production
    const errorMessage = error.name === 'ResourceNotFoundException'
      ? 'Email storage service not configured. Please contact support.'
      : error.message || 'Failed to subscribe email';

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
