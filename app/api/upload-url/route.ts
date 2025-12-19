import { NextRequest, NextResponse } from 'next/server';
import { generateUploadUrl } from '@/lib/s3-client';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Generate presigned URLs for uploading files to S3
 * POST body: { files: [{ name: string, type: string, size: number }] }
 * Returns: { urls: [{ url: string, key: string }] }
 */
export async function POST(request: NextRequest) {
  const requestId = `upload-url-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`[${requestId}] Upload URL request initiated`);
  
  // Debug: Log environment variables and Secrets (without exposing values)
  // Note: Amplify Secrets are available as env vars with their exact names (e.g., _AWS_*)
  console.log(`[${requestId}] Environment check:`, {
    hasRegion: !!(process.env._AWS_REGION || process.env.AMAZON_REGION || process.env.AWS_REGION || process.env.AMPLIFY_SECRET_AWS_REGION),
    hasAccessKey: !!(process.env._AWS_ACCESS_KEY_ID || process.env.AMAZON_ACCESS_KEY_ID || process.env.AMPLIFY_SECRET_AWS_ACCESS_KEY_ID),
    hasSecretKey: !!(process.env._AWS_SECRET_ACCESS_KEY || process.env.AMAZON_SECRET_ACCESS_KEY || process.env.AMPLIFY_SECRET_AWS_SECRET_ACCESS_KEY),
    hasBucketName: !!(process.env._AWS_S3_BUCKET_NAME || process.env.AMAZON_S3_BUCKET_NAME || process.env.AMPLIFY_SECRET_AWS_S3_BUCKET_NAME),
    bucketName: process.env._AWS_S3_BUCKET_NAME || process.env.AMAZON_S3_BUCKET_NAME || process.env.AMPLIFY_SECRET_AWS_S3_BUCKET_NAME || 'NOT SET',
    // Check for Secrets format
    amplifySecrets: Object.keys(process.env).filter(k => k.startsWith('AMPLIFY_SECRET_')).length,
    // Check for _AWS_ prefix (Amplify Secrets format)
    awsSecrets: Object.keys(process.env).filter(k => k.startsWith('_AWS_')).length,
  });
  
  try {
    const body = await request.json();
    const { files } = body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { error: 'Files array is required' },
        { status: 400 }
      );
    }

    console.log(`[${requestId}] Generating ${files.length} presigned URLs...`);

    // Generate presigned URLs for each file
    const urls = await Promise.all(
      files.map(async (file: { name: string; type?: string; size?: number }) => {
        const result = await generateUploadUrl(
          file.name,
          file.type || 'application/pdf'
        );
        const { url, key } = JSON.parse(result);
        return { url, key, fileName: file.name };
      })
    );

    console.log(`[${requestId}] Generated ${urls.length} presigned URLs`);

    return NextResponse.json({
      success: true,
      urls,
      requestId,
    });
  } catch (error) {
    console.error(`[${requestId}] Error generating upload URLs:`, error);
    
    const errorMessage = error instanceof Error
      ? error.message
      : 'Failed to generate upload URLs';

    return NextResponse.json(
      { error: errorMessage, requestId },
      { status: 500 }
    );
  }
}

