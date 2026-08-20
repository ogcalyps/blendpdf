import { NextRequest, NextResponse } from 'next/server';

/**
 * API Route: Upload processed file back to Google Drive
 * 
 * This endpoint uploads a processed file back to the user's Google Drive.
 * 
 * Security: The access token is provided by the client (from OAuth flow).
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
    const { fileData, fileName, folderId, accessToken } = body;

    if (!fileData || !fileName || !accessToken) {
      return NextResponse.json(
        { error: 'Missing required parameters: fileData, fileName, accessToken' },
        { status: 400 }
      );
    }

    // Convert base64 to blob if needed
    let blob: Blob;
    if (fileData.startsWith('data:')) {
      // Base64 data URL
      const base64Data = fileData.split(',')[1];
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      blob = new Blob([bytes], { type: 'application/pdf' });
    } else {
      // Already a blob or buffer
      blob = new Blob([fileData], { type: 'application/pdf' });
    }

    // Create metadata for Google Drive
    const metadata = {
      name: fileName,
      ...(folderId && { parents: [folderId] }),
    };

    // Create form data for multipart upload
    const formData = new FormData();
    formData.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], { type: 'application/json' })
    );
    formData.append('file', blob);

    // Upload to Google Drive
    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Google Drive] Failed to upload file:', errorText);
      return NextResponse.json(
        { error: `Failed to upload file to Google Drive: ${response.statusText}` },
        { status: response.status }
      );
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      fileId: result.id,
      webViewLink: result.webViewLink,
    });
  } catch (error: any) {
    console.error('[Google Drive] Error uploading file:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upload file to Google Drive' },
      { status: 500 }
    );
  }
}
