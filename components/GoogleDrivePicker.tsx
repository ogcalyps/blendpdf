'use client';

import { useState, useEffect, useCallback } from 'react';
import { Cloud, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { trackFileUpload } from '@/lib/analytics';

interface GoogleDrivePickerProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
  multiple?: boolean;
  accept?: string[];
  className?: string;
}

/**
 * Google Drive Picker Component
 * Allows users to select files from their Google Drive
 */
export function GoogleDrivePicker({
  onFilesSelected,
  disabled = false,
  multiple = true,
  accept = ['application/pdf'],
  className = '',
}: GoogleDrivePickerProps) {
  const t = useTranslations('googleDrive');
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const isGoogleDriveEnabled = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_ENABLED === 'true' && process.env.NODE_ENV !== 'production';

  // Load Google API scripts
  useEffect(() => {
    // The button renders nothing when Drive is off (always, in production), so
    // load nothing either: these two scripts held tool pages' first paint.
    if (!isGoogleDriveEnabled) return;

    console.log('[GoogleDrive] Environment check:', {
      hasApiKey: !!apiKey,
      apiKeyPrefix: apiKey ? `${apiKey.substring(0, 10)}...` : 'MISSING',
      hasClientId: !!clientId,
      clientIdPrefix: clientId ? `${clientId.substring(0, 20)}...` : 'MISSING',
    });

    if (!apiKey || !clientId) {
      console.error('[GoogleDrive] Missing credentials:', {
        apiKey: !apiKey ? 'MISSING' : 'OK',
        clientId: !clientId ? 'MISSING' : 'OK',
      });
      setError(t('notConfigured'));
      return;
    }

    // Listen for postMessage events from picker iframe (might contain errors)
    const handleMessage = (event: MessageEvent) => {
      // Only process messages that might be from Google Picker
      if (event.origin.includes('google') || event.origin.includes('docs.google')) {
        console.log('[GoogleDrive] Received postMessage from picker:', {
          origin: event.origin,
          data: event.data,
          type: typeof event.data,
        });
        
        // Check if message contains error
        const messageStr = JSON.stringify(event.data).toLowerCase();
        if (messageStr.includes('error') || messageStr.includes('invalid') || messageStr.includes('developer key')) {
          console.error('[GoogleDrive] Error detected in postMessage:', event.data);
        }
      }
    };

    window.addEventListener('message', handleMessage);

    // Check if scripts are already loaded
    if (window.google && window.google.accounts && window.google.picker) {
      console.log('[GoogleDrive] Scripts already loaded');
      setScriptLoaded(true);
      // Return cleanup function only (scripts already loaded, no need to load them)
      return () => {
        window.removeEventListener('message', handleMessage);
      };
    }

    // Load Google Identity Services (GIS) script (new API)
    if (!document.querySelector('script[src*="accounts.google.com/gsi/client"]')) {
      console.log('[GoogleDrive] Loading Google Identity Services script...');
      const gisScript = document.createElement('script');
      gisScript.src = 'https://accounts.google.com/gsi/client';
      gisScript.async = true;
      gisScript.defer = true;
      gisScript.onload = () => {
        // Load picker script
        const pickerScript = document.createElement('script');
        pickerScript.src = 'https://apis.google.com/js/picker.js';
        pickerScript.async = true;
        pickerScript.defer = true;
        pickerScript.onload = () => {
          console.log('[GoogleDrive] Picker script loaded, waiting for initialization...');
          // Wait a bit for scripts to fully initialize
          setTimeout(() => {
            const hasGoogle = !!window.google;
            const hasAccounts = !!(window.google && window.google.accounts);
            const hasPicker = !!(window.google && window.google.picker);
            
            console.log('[GoogleDrive] Script initialization check:', {
              hasGoogle,
              hasAccounts,
              hasPicker,
            });
            
            if (hasGoogle && hasAccounts && hasPicker) {
              console.log('[GoogleDrive] ✅ All scripts initialized successfully - enabling button');
              setScriptLoaded(true);
            } else {
              console.error('[GoogleDrive] ❌ Scripts loaded but not initialized:', {
                hasGoogle,
                hasAccounts,
                hasPicker,
              });
              setError(t('scriptLoadFailed'));
            }
          }, 200); // Increased timeout to give scripts more time
        };
        pickerScript.onerror = (error) => {
          console.error('[GoogleDrive] ❌ Failed to load Picker script:', error);
          setError(t('scriptLoadFailed'));
        };
        document.head.appendChild(pickerScript);
      };
      gisScript.onerror = (error) => {
        console.error('[GoogleDrive] ❌ Failed to load GIS script:', error);
        setError(t('scriptLoadFailed'));
      };
      document.head.appendChild(gisScript);
    } else {
      // Scripts are loading, wait for them
      const checkInterval = setInterval(() => {
        if (window.google && window.google.accounts && window.google.picker) {
          console.log('[GoogleDrive] Scripts loaded via interval check');
          setScriptLoaded(true);
          clearInterval(checkInterval);
        }
      }, 100);
      
      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        // Check actual window objects because scriptLoaded state might be stale in this closure
        if (!(window.google && window.google.accounts && window.google.picker)) {
          console.error('[GoogleDrive] Scripts failed to load within timeout');
          setError(t('scriptsTimeout'));
        }
      }, 10000);
    }

    // Return cleanup function
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [apiKey, clientId, isGoogleDriveEnabled, t]);

  const handleGoogleDriveClick = useCallback(async () => {
    if (!apiKey || !clientId) {
      setError(t('notConfigured'));
      return;
    }

    if (!scriptLoaded) {
      setError(t('scriptsLoading'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('[GoogleDrive] Starting authentication...', { clientId, hasApiKey: !!apiKey });
      
      // Step 1: Authenticate
      const accessToken = await authenticateGoogleDrive(clientId);
      console.log('[GoogleDrive] Authentication successful, access token received');
      setIsAuthenticated(true);

      // Step 2: Open picker
      if (!window.google || !window.google.picker) {
        console.error('[GoogleDrive] Google Picker API not available', { 
          hasGoogle: !!window.google, 
          hasPicker: !!(window.google && window.google.picker),
          hasAccounts: !!(window.google && window.google.accounts)
        });
        throw new Error('Google Picker API not available. Please refresh the page.');
      }

      console.log('[GoogleDrive] Creating picker...', { 
        apiKey: apiKey?.substring(0, 10) + '...', 
        hasAccessToken: !!accessToken,
        accessTokenLength: accessToken?.length 
      });
      
      // Create picker immediately (no delays to preserve user activation)
      const picker = createPicker(apiKey, accessToken, multiple, accept);
      console.log('[GoogleDrive] Picker created, setting visible immediately...');
      
      // Set visible immediately - must be called synchronously after user action
      // Any async delay will break browser's user activation requirement
      try {
        picker.setVisible(true);
        console.log('[GoogleDrive] Picker setVisible called successfully');
        
        // Monitor for picker iframe creation and check its URL for errors
        // The picker request might return 200 but contain error HTML
        setTimeout(() => {
          const pickerIframes = document.querySelectorAll('iframe[src*="picker"], iframe[src*="docs.google"]');
          console.log('[GoogleDrive] Picker iframes found:', pickerIframes.length);
          
          pickerIframes.forEach((iframe, index) => {
            const iframeEl = iframe as HTMLIFrameElement;
            const src = iframeEl.src;
            console.log(`[GoogleDrive] Iframe ${index}:`, {
              src: src.substring(0, 200) + '...', // Truncate long URLs
              fullSrc: src,
              visible: iframeEl.offsetWidth > 0 && iframeEl.offsetHeight > 0,
              width: iframeEl.offsetWidth,
              height: iframeEl.offsetHeight,
            });
            
            // Check if URL contains developerKey parameter
            if (src.includes('developerKey')) {
              const urlParams = new URLSearchParams(src.split('?')[1] || '');
              const devKey = urlParams.get('developerKey');
              console.log(`[GoogleDrive] Developer key in iframe ${index} URL:`, {
                present: !!devKey,
                prefix: devKey ? devKey.substring(0, 10) + '...' : 'NOT FOUND',
                matches: devKey === apiKey,
              });
            }
            
            // Listen for iframe load events
            iframeEl.addEventListener('load', () => {
              console.log(`[GoogleDrive] Iframe ${index} loaded`);
              // Try to check for errors in iframe (may fail due to CORS)
              try {
                const iframeDoc = iframeEl.contentDocument || iframeEl.contentWindow?.document;
                if (iframeDoc) {
                  const bodyText = iframeDoc.body?.innerText || '';
                  if (bodyText.toLowerCase().includes('error') || 
                      bodyText.toLowerCase().includes('invalid') ||
                      bodyText.toLowerCase().includes('developer key')) {
                    console.error(`[GoogleDrive] Error text found in iframe ${index}:`, bodyText);
                  }
                }
              } catch (e) {
                // CORS - can't access iframe content, which is normal
                console.log(`[GoogleDrive] Cannot access iframe ${index} content (CORS - normal):`, e);
              }
            });
          });
          
          // If no iframe appeared after 2 seconds, picker might have failed silently
          if (pickerIframes.length === 0) {
            console.warn('[GoogleDrive] No picker iframe detected - picker may have failed to open');
          }
        }, 2000);
        
      } catch (error: any) {
        console.error('[GoogleDrive] Error calling setVisible:', error);
        setError(t('openPickerFailed'));
        setIsLoading(false);
      }

      // Handle file selection
      window.handleGoogleDriveFiles = async (files: any[]) => {
        try {
          // Download files from Google Drive via our API
          const downloadedFiles = await Promise.all(
            files.map(async (file) => {
              const response = await fetch('/api/google-drive/download', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  fileId: file.id,
                  fileName: file.name,
                  accessToken: accessToken,
                }),
              });

              if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: response.statusText }));
                throw new Error(errorData.error || `Failed to download ${file.name}`);
              }

              const blob = await response.blob();
              return new File([blob], file.name, { type: blob.type });
            })
          );

          // Tracked here rather than in each caller so no Drive path is missed
          trackFileUpload(downloadedFiles, 'google_drive');
          onFilesSelected(downloadedFiles);
        } catch (err: any) {
          setError(err.message || t('downloadFailed'));
        } finally {
          setIsLoading(false);
        }
      };

      // Handle picker cancellation
      window.handleGoogleDriveCancel = () => {
        setIsLoading(false);
        setError(null);
      };
    } catch (err: any) {
      console.error('[GoogleDrive] Error in handleGoogleDriveClick:', err);
      const errorMessage = err.message || err.error || t('connectFailed');
      setError(errorMessage);
      setIsLoading(false);
    }
  }, [apiKey, clientId, scriptLoaded, multiple, accept, onFilesSelected, t]);

  // Don't show button if Google Drive is disabled or not configured
  if (!isGoogleDriveEnabled || !apiKey || !clientId) {
    return null;
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleGoogleDriveClick}
        disabled={disabled || isLoading || !scriptLoaded}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border-2 border-gray-300 hover:border-blue-500 hover:bg-blue-50 text-gray-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>{t('connecting')}</span>
          </>
        ) : (
          <>
            <Cloud className="w-5 h-5" />
            <span>{t('chooseFrom')}</span>
          </>
        )}
      </button>

      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}

// Helper functions
async function authenticateGoogleDrive(
  clientId: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log('[GoogleDrive] authenticateGoogleDrive called', { clientId: clientId?.substring(0, 20) + '...' });
    
    // Use new Google Identity Services (GIS) API instead of deprecated gapi.auth2
    if (!window.google || !window.google.accounts) {
      console.error('[GoogleDrive] Google Identity Services not loaded');
      reject(new Error('Google Identity Services not loaded. Please wait a moment and try again.'));
      return;
    }

    console.log('[GoogleDrive] Using Google Identity Services (GIS) API...');
    
    try {
      // Use new Google Identity Services (GIS) API
      const googleAccounts = (window.google as any)?.accounts;
      if (!googleAccounts || !googleAccounts.oauth2) {
        reject(new Error('Google Identity Services not loaded. Please refresh the page.'));
        return;
      }

      // Initialize token client for OAuth 2.0
      const tokenClient = googleAccounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive.readonly',
        callback: (response: any) => {
          if (response.error) {
            console.error('[GoogleDrive] Token error:', response.error);
            reject(new Error(response.error));
            return;
          }
          
          if (!response.access_token) {
            reject(new Error('No access token received from Google'));
            return;
          }
          
          console.log('[GoogleDrive] Token received successfully');
          resolve(response.access_token);
        },
      });

      console.log('[GoogleDrive] Requesting access token...');
      // Request access token (will trigger OAuth popup)
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (error: any) {
      console.error('[GoogleDrive] GIS initialization error:', error);
      reject(error);
    }
  });
}

function createPicker(
  apiKey: string,
  accessToken: string,
  multiple: boolean,
  accept: string[]
) {
  console.log('[GoogleDrive] createPicker called', { 
    hasApiKey: !!apiKey,
    apiKeyPrefix: apiKey ? `${apiKey.substring(0, 10)}...` : 'MISSING',
    apiKeyLength: apiKey?.length || 0,
    hasAccessToken: !!accessToken,
    accessTokenPrefix: accessToken ? `${accessToken.substring(0, 20)}...` : 'MISSING',
    multiple,
    accept 
  });

  if (!apiKey) {
    throw new Error('API key is missing. Please check NEXT_PUBLIC_GOOGLE_API_KEY environment variable.');
  }

  if (apiKey.length < 30) {
    console.warn('[GoogleDrive] API key seems too short. Expected ~39 characters, got:', apiKey.length);
  }

  if (!window.google || !window.google.picker) {
    console.error('[GoogleDrive] Google Picker API not available', {
      hasGoogle: !!window.google,
      hasPicker: !!(window.google && window.google.picker)
    });
    throw new Error('Google Picker API not loaded');
  }

  try {
    // Type assertion for DocsView since it's dynamically loaded
    const DocsView = (window.google.picker as any).DocsView;
    if (!DocsView) {
      throw new Error('DocsView not available in Google Picker API');
    }
    const view = new DocsView(
      window.google.picker.ViewId.DOCS
    );
    console.log('[GoogleDrive] DocsView created');

    // Filter by MIME type if PDF only
    if (accept.includes('application/pdf')) {
      view.setMimeTypes('application/pdf');
      console.log('[GoogleDrive] Filtered to PDF files only');
    }

    // Enable multiple selection if needed
    if (multiple) {
      view.setSelectFolderEnabled(false);
    }

    console.log('[GoogleDrive] Building picker...');
    console.log('[GoogleDrive] API Key details:', {
      key: apiKey,
      length: apiKey.length,
      startsWithAIza: apiKey.startsWith('AIza'),
      first10: apiKey.substring(0, 10),
      last10: apiKey.substring(apiKey.length - 10),
    });
    
    const pickerApi = window.google.picker as any;
    console.log('[GoogleDrive] Picker API available:', {
      hasPickerBuilder: !!pickerApi.PickerBuilder,
      hasViewId: !!pickerApi.ViewId,
      hasResponse: !!pickerApi.Response,
      hasAction: !!pickerApi.Action,
    });
    
    // Verify Response.ERROR exists
    if (pickerApi.Response) {
      console.log('[GoogleDrive] Response object keys:', Object.keys(pickerApi.Response));
      console.log('[GoogleDrive] Response.ERROR key:', pickerApi.Response.ERROR);
    }
    
    let pickerBuilder = new pickerApi.PickerBuilder()
      .setDeveloperKey(apiKey) // Required: API key for Google Picker
      .setOAuthToken(accessToken)
      .addView(view);
    
    console.log('[GoogleDrive] Picker builder created with API key:', {
      apiKeySet: true,
      oauthTokenSet: !!accessToken,
      viewAdded: true,
    });
    
    // Enable multi-select if needed (only if Feature is available)
    if (pickerApi.Feature && pickerApi.Feature.MULTISELECT_ENABLED) {
      pickerBuilder = pickerBuilder.enableFeature(pickerApi.Feature.MULTISELECT_ENABLED);
    }
    
    const picker = pickerBuilder.setCallback((data: any) => {
        console.log('[GoogleDrive] ========== PICKER CALLBACK FIRED ==========');
        console.log('[GoogleDrive] Picker callback received', data);
        console.log('[GoogleDrive] Full callback data:', JSON.stringify(data, null, 2));
        console.log('[GoogleDrive] Data type:', typeof data);
        console.log('[GoogleDrive] Data keys:', data ? Object.keys(data) : 'null/undefined');
        
        // Log all possible error fields - check multiple possible error keys
        const ERROR_KEY = pickerApi.Response?.ERROR;
        console.log('[GoogleDrive] ERROR_KEY constant:', ERROR_KEY);
        
        // Check for error in multiple possible locations
        const error = data?.[ERROR_KEY] || 
                     data?.error || 
                     data?.ERROR ||
                     (data && typeof data === 'object' && Object.values(data).find((v: any) => 
                       typeof v === 'string' && v.toLowerCase().includes('invalid')
                     ));
        
        console.log('[GoogleDrive] Error check result:', {
          ERROR_KEY,
          errorFromKey: data?.[ERROR_KEY],
          errorFromError: data?.error,
          errorFromERROR: data?.ERROR,
          finalError: error,
        });
        
        if (error) {
          console.error('[GoogleDrive] ========== PICKER ERROR DETECTED ==========');
          console.error('[GoogleDrive] Error value:', error);
          console.error('[GoogleDrive] Error type:', typeof error);
          console.error('[GoogleDrive] Full response object:', data);
          console.error('[GoogleDrive] All response keys:', Object.keys(data || {}));
          
          // Check for specific error codes
          const errorString = String(error).toLowerCase();
          console.error('[GoogleDrive] Error string (lowercase):', errorString);
          
          if (errorString.includes('developer key') || 
              errorString.includes('api key') ||
              errorString.includes('invalid') ||
              error === 'developerKeyNotValid' || 
              error === 'developerKeyInvalid') {
            console.error('[GoogleDrive] ========== API KEY ERROR ==========');
            console.error('[GoogleDrive] API Key used:', apiKey);
            console.error('[GoogleDrive] API Key length:', apiKey.length);
            console.error('[GoogleDrive] Possible causes:');
            console.error('  1. API key is incorrect or invalid');
            console.error('  2. API key not enabled for Google Picker API');
            console.error('  3. API key and Client ID from different projects');
            console.error('  4. API key restrictions blocking the request');
            console.error('  5. Google Picker API not enabled in project');
            
            if (window.handleGoogleDriveError) {
              window.handleGoogleDriveError('The API developer key is invalid. Please verify: 1) API key is correct, 2) Google Picker API is enabled, 3) API key and Client ID are from the same project.');
            }
          } else {
            console.error('[GoogleDrive] Other picker error:', error);
            if (window.handleGoogleDriveError) {
              window.handleGoogleDriveError(`Google Drive error: ${error}`);
            }
          }
          return;
        }
        
        // Use pickerApi constants instead of window.google.picker
        const ACTION_KEY = pickerApi.Response.ACTION;
        const DOCUMENTS_KEY = pickerApi.Response.DOCUMENTS;
        const PICKED_ACTION = pickerApi.Action.PICKED;
        const CANCEL_ACTION = pickerApi.Action.CANCEL;
        
        if (!data || !data[ACTION_KEY]) {
          console.warn('[GoogleDrive] Unknown picker response', data);
          // Unknown response
          if (window.handleGoogleDriveCancel) {
            window.handleGoogleDriveCancel();
          }
          return;
        }

        const action = data[ACTION_KEY];
        console.log('[GoogleDrive] Picker action:', action);
        
        if (action === PICKED_ACTION) {
          const docs = data[DOCUMENTS_KEY];
          console.log('[GoogleDrive] Files picked:', docs?.length || 0);
          if (docs && docs.length > 0 && window.handleGoogleDriveFiles) {
            window.handleGoogleDriveFiles(docs);
          }
        } else if (action === CANCEL_ACTION) {
          console.log('[GoogleDrive] User cancelled picker');
          // User cancelled - reset loading state
          if (window.handleGoogleDriveCancel) {
            window.handleGoogleDriveCancel();
          }
        } else {
          console.warn('[GoogleDrive] Unknown action:', action);
        }
      })
      .build();

    console.log('[GoogleDrive] Picker built successfully');
    return picker;
  } catch (error: any) {
    console.error('[GoogleDrive] Error creating picker:', error);
    throw error;
  }
}

// Extend Window interface
// Note: google is declared as 'any' in lib/google-drive.ts to avoid conflicts
// Adding only the handler functions here
declare global {
  interface Window {
    handleGoogleDriveFiles?: (files: any[]) => void;
    handleGoogleDriveCancel?: () => void;
    handleGoogleDriveError?: (errorMessage: string) => void;
  }
}
