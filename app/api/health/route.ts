import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET() {
  const timestamp = new Date().toISOString();
  console.log(`[HEALTH] Health check at ${timestamp}`);
  console.error(`[HEALTH] Health check at ${timestamp}`); // Also to stderr
  
  return NextResponse.json({
    status: 'ok',
    timestamp,
    runtime: 'nodejs',
  });
}

// Add POST endpoint to test if POST requests work at all
export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  console.log(`[HEALTH] POST request received at ${timestamp}`);
  console.error(`[HEALTH] POST request received at ${timestamp}`);
  
  // Try to read the request body (without FormData)
  try {
    const contentType = request.headers.get('content-type');
    const contentLength = request.headers.get('content-length');
    console.log(`[HEALTH] POST - Content-Type: ${contentType}, Content-Length: ${contentLength}`);
    
    // Don't await body - just check if request is readable
    return NextResponse.json({
      status: 'ok',
      method: 'POST',
      timestamp,
      contentType,
      contentLength,
      message: 'POST requests work',
    });
  } catch (error) {
    console.error(`[HEALTH] POST error:`, error);
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

