import { NextRequest, NextResponse } from 'next/server';

/**
 * API Route: Download file from Google Drive
 * 
 * This endpoint downloads a file from Google Drive using the user's access token.
 * The file is then returned as a blob that can be used by the client.
 * 
 * Security: The access token is provided by the client (from OAuth flow),
 * but we validate it and download the file server-side to avoid CORS issues.
 */
export async function POST(request: NextRequest) {
  // Disable in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Google Drive integration is disabled in production.' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { fileId, fileName, accessToken } = body;

    if (!fileId || !fileName || !accessToken) {
      return NextResponse.json(
        { error: 'Missing required parameters: fileId, fileName, accessToken' },
        { status: 400 }
      );
    }

    // Download file from Google Drive
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Google Drive] Failed to download file ${fileId}:`, errorText);
      return NextResponse.json(
        { error: `Failed to download file from Google Drive: ${response.statusText}` },
        { status: response.status }
      );
    }

    // Get file as blob
    const blob = await response.blob();

    // Return file as blob with proper headers
    return new NextResponse(blob, {
      headers: {
        'Content-Type': blob.type || 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    console.error('[Google Drive] Error downloading file:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to download file from Google Drive' },
      { status: 500 }
    );
  }
}
