import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Simple test endpoint to see if POST requests work at all
export async function POST(request: NextRequest) {
  console.log('========== MERGE TEST ENDPOINT CALLED ==========');
  console.error('========== MERGE TEST ENDPOINT CALLED ==========');
  
  try {
    const body = await request.json();
    console.log('Test endpoint received body:', {
      hasFiles: !!body.files,
      fileCount: body.files?.length || 0,
      bodySize: JSON.stringify(body).length,
    });
    
    return NextResponse.json({
      success: true,
      message: 'Test endpoint works!',
      received: {
        fileCount: body.files?.length || 0,
        bodySize: JSON.stringify(body).length,
      },
    });
  } catch (error) {
    console.error('Test endpoint error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

