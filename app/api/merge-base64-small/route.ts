import { NextRequest, NextResponse } from 'next/server';
import { mergePDFs } from '@/lib/pdf-processor';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Test endpoint with very small payload to find Amplify's limit
export async function POST(request: NextRequest) {
  console.log('========== MERGE BASE64 SMALL ENDPOINT CALLED ==========');
  console.error('========== MERGE BASE64 SMALL ENDPOINT CALLED ==========');
  
  const startTime = Date.now();
  const requestId = `merge-base64-small-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`[${requestId}] MERGE BASE64 SMALL REQUEST INITIATED`);
  console.error(`[${requestId}] MERGE BASE64 SMALL REQUEST INITIATED`);
  
  try {
    const body = await request.json();
    const payloadSize = JSON.stringify(body).length;
    
    console.log(`[${requestId}] Received request, payload size: ${(payloadSize / 1024).toFixed(2)}KB`);
    console.log(`[${requestId}] File count: ${body.files?.length || 0}`);
    
    // For testing, just return success without processing
    return NextResponse.json({
      success: true,
      message: 'Small endpoint works!',
      payloadSize: `${(payloadSize / 1024).toFixed(2)}KB`,
      requestId,
    });
  } catch (error) {
    console.error(`[${requestId}] Error:`, error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

