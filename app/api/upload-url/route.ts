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

