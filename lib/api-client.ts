import type { CompressionLevel } from '@/types';

export async function mergePDFs(files: File[]): Promise<Blob> {
  const startTime = Date.now();
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  
  console.log(`[Client] Starting merge: ${files.length} files, ${(totalSize / 1024 / 1024).toFixed(2)}MB total`);
  
  try {
    const formData = new FormData();
    files.forEach((f, index) => {
      console.log(`[Client] Adding file ${index + 1}/${files.length}: ${f.name} (${(f.size / 1024 / 1024).toFixed(2)}MB)`);
      formData.append('files', f);
    });

    console.log(`[Client] Sending request to /api/merge...`);
    console.log(`[Client] Request URL: ${window.location.origin}/api/merge`);
    console.log(`[Client] FormData entries: ${files.length} files`);
    
    const requestStart = Date.now();
    
    // Add timeout (30 seconds for large files, but also check for immediate failures)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.error(`[Client] Request timeout after 30 seconds`);
      controller.abort();
    }, 30000);
    
    let response: Response;
    try {
      // DO NOT set Content-Type header - browser will set it automatically with boundary
      // Amplify might be stripping/transforming headers, so let the browser handle it
      response = await fetch('/api/merge', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
        // Only set custom headers, NOT Content-Type
        headers: {
          'X-Request-Type': 'merge',
          'X-File-Count': String(files.length),
        },
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      const requestTime = Date.now() - requestStart;
      console.error(`[Client] Fetch error after ${requestTime}ms:`, fetchError);
      
      if (fetchError instanceof Error) {
        if (fetchError.name === 'AbortError') {
          throw new Error('Request timed out after 30 seconds. The files may be too large or the server is not responding.');
        }
        throw new Error(`Network error: ${fetchError.message}`);
      }
      throw fetchError;
    }
    
    clearTimeout(timeoutId);
    const requestTime = Date.now() - requestStart;
    console.log(`[Client] Request completed in ${requestTime}ms, status: ${response.status}`);
    
    if (!response.ok) {
      console.error(`[Client] Response not OK: ${response.status} ${response.statusText}`);
    }

    if (!response.ok) {
      try {
        const errorData = await response.json();
        const errorMessage = errorData.error || errorData.message || 'Failed to merge PDFs';
        const requestId = errorData.requestId || 'unknown';
        const processingTime = errorData.processingTime || 'unknown';
        
        console.error(`[Client] Merge failed: ${errorMessage} (Request ID: ${requestId}, Processing: ${processingTime})`);
        throw new Error(`${errorMessage} (Request ID: ${requestId})`);
      } catch (parseError) {
        console.error(`[Client] Failed to parse error response:`, parseError);
        throw new Error(`Failed to merge PDFs (HTTP ${response.status})`);
      }
    }

    const blob = await response.blob();
    const totalTime = Date.now() - startTime;
    console.log(`[Client] Merge successful! Total time: ${totalTime}ms, Result size: ${(blob.size / 1024 / 1024).toFixed(2)}MB`);
    
    return blob;
  } catch (error) {
    const totalTime = Date.now() - startTime;
    
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      console.error(`[Client] Network error after ${totalTime}ms`);
      throw new Error('Connection failed. Please check your internet connection and try again.');
    }
    
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`[Client] Request timeout after ${totalTime}ms`);
      throw new Error('Request timed out. The files may be too large. Please try with smaller files.');
    }
    
    console.error(`[Client] Merge error after ${totalTime}ms:`, error);
    throw error;
  }
}

export async function compressPDF(file: File, level: CompressionLevel): Promise<Blob> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('level', level);

    const response = await fetch('/api/compress', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      try {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Failed to compress PDF');
      } catch {
        throw new Error('Failed to compress PDF');
      }
    }

    return await response.blob();
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('Connection failed');
    }
    throw error;
  }
}

export async function splitPDF(file: File, ranges: string): Promise<Blob> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('ranges', ranges);

    const response = await fetch('/api/split', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      try {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Failed to split PDF');
      } catch {
        throw new Error('Failed to split PDF');
      }
    }

    return await response.blob();
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('Connection failed');
    }
    throw error;
  }
}

