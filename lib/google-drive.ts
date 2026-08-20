/**
 * Google Drive API Client
 * Handles authentication and file operations
 */

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  webViewLink?: string;
  thumbnailLink?: string;
}

export interface GoogleDriveAuth {
  accessToken: string;
  expiresAt: number;
}

/**
 * Initialize Google Drive Picker
 * Requires Google API script to be loaded
 */
export function initGoogleDrivePicker(
  apiKey: string,
  clientId: string,
  onFileSelected: (files: GoogleDriveFile[]) => void,
  onError?: (error: Error) => void
) {
  if (typeof window === 'undefined' || !window.gapi || !window.google) {
    throw new Error('Google API script not loaded');
  }

  const pickerApi = window.google.picker as any;
  const picker = new pickerApi.PickerBuilder()
    .setOAuthToken(null) // Will be set after auth
    .addView(pickerApi.ViewId.DOCS)
    .setCallback((data: any) => {
      if (data[pickerApi.Response.ACTION] === pickerApi.Action.PICKED) {
        const files: GoogleDriveFile[] = data[pickerApi.Response.DOCUMENTS].map(
          (doc: any) => ({
            id: doc.id,
            name: doc.name,
            mimeType: doc.mimeType,
            size: doc.sizeBytes,
            webViewLink: doc.url,
            thumbnailLink: doc.thumbnailLink,
          })
        );
        onFileSelected(files);
      } else if (data[pickerApi.Response.ACTION] === pickerApi.Action.CANCEL) {
        // User cancelled
      }
    })
    .build();

  return picker;
}

/**
 * Authenticate with Google Drive
 */
export async function authenticateGoogleDrive(
  clientId: string,
  scope: string = 'https://www.googleapis.com/auth/drive.readonly'
): Promise<GoogleDriveAuth> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.gapi) {
      reject(new Error('Google API script not loaded'));
      return;
    }

    window.gapi.load('auth2', () => {
      window.gapi.auth2
        .init({
          client_id: clientId,
        })
        .then(() => {
          const authInstance = window.gapi.auth2.getAuthInstance();
          authInstance
            .signIn({
              scope: scope,
            })
            .then((googleUser: any) => {
              const authResponse = googleUser.getAuthResponse();
              resolve({
                accessToken: authResponse.access_token,
                expiresAt: Date.now() + authResponse.expires_in * 1000,
              });
            })
            .catch(reject);
        })
        .catch(reject);
    });
  });
}

/**
 * Download file from Google Drive
 * This should be done server-side for security
 */
export async function downloadGoogleDriveFile(
  fileId: string,
  accessToken: string
): Promise<Blob> {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`);
  }

  return response.blob();
}

// TypeScript declarations for Google API
// Using 'any' for Google APIs since they're dynamically loaded
declare global {
  interface Window {
    gapi?: any;
    google?: any;
  }
}
