import type { CompressionLevel } from '@/types';

export async function mergePDFs(files: File[]): Promise<Blob> {
  const startTime = Date.now();
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  
  console.log(`[Client] Starting merge: ${files.length} files, ${(totalSize / 1024 / 1024).toFixed(2)}MB total`);
  
  // Use S3 for all file uploads (most reliable)
  console.log(`[Client] Using S3 upload method for reliable file handling`);
  return mergePDFsS3(files);
}

async function mergePDFsS3(files: File[]): Promise<Blob> {
  const startTime = Date.now();
  console.log(`[Client] Using S3 upload method for ${files.length} files`);
  
  try {
    // Step 1: Get presigned URLs
    console.log(`[Client] Step 1: Requesting presigned URLs...`);
    const urlResponse = await fetch('/api/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files: files.map(f => ({
          name: f.name,
          type: f.type,
          size: f.size,
        })),
      }),
    });

    if (!urlResponse.ok) {
      const errorData = await urlResponse.json();
      throw new Error(errorData.error || 'Failed to get upload URLs');
    }

    const { urls } = await urlResponse.json() as { urls: Array<{ url: string; key: string; fileName: string }> };
    console.log(`[Client] Received ${urls.length} presigned URLs`);

    // Step 2: Upload files directly to S3
    console.log(`[Client] Step 2: Uploading files to S3...`);
    const uploadStart = Date.now();
    
    await Promise.all(
      files.map(async (file, index) => {
        const { url, key } = urls[index];
        const fileStart = Date.now();
        
        console.log(`[Client] Uploading file ${index + 1}/${files.length} (${file.name}) to S3...`);
        
        const uploadResponse = await fetch(url, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type || 'application/pdf',
          },
        });

        if (!uploadResponse.ok) {
          throw new Error(`Failed to upload ${file.name} to S3: ${uploadResponse.statusText}`);
        }

        console.log(`[Client] File ${index + 1} uploaded in ${Date.now() - fileStart}ms`);
        return key;
      })
    );
    
    console.log(`[Client] All files uploaded to S3 in ${Date.now() - uploadStart}ms`);

    // Step 3: Request merge from S3
    console.log(`[Client] Step 3: Requesting merge from S3...`);
    const mergeStart = Date.now();
    
    const mergeResponse = await fetch('/api/merge-s3', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keys: urls.map((u: { url: string; key: string; fileName: string }) => u.key),
      }),
    });

    if (!mergeResponse.ok) {
      const errorData = await mergeResponse.json();
      throw new Error(errorData.error || 'Failed to merge PDFs');
    }

    const result = await mergeResponse.json();
    console.log(`[Client] Merge completed in ${Date.now() - mergeStart}ms`);

    // Step 4: Convert Base64 result to Blob
    const base64Data = result.data.replace(/^data:application\/pdf;base64,/, '');
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    console.log(`[Client] S3 merge successful! Total time: ${Date.now() - startTime}ms`);
    return new Blob([bytes], { type: 'application/pdf' });
  } catch (error) {
    console.error(`[Client] S3 merge error after ${Date.now() - startTime}ms:`, error);
    throw error;
  }
}

async function mergePDFsBase64(files: File[]): Promise<Blob> {
  const startTime = Date.now();
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  
  console.log(`[Client] Converting ${files.length} files to Base64...`);
  console.log(`[Client] File sizes:`, files.map(f => `${f.name}: ${(f.size / 1024 / 1024).toFixed(2)}MB`));
  console.log(`[Client] Total original size: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);
  
  // Convert files to Base64 (more efficient method for large files)
  const base64Files = await Promise.all(
    files.map(async (file, index) => {
      const fileStart = Date.now();
      console.log(`[Client] Converting file ${index + 1}/${files.length} (${file.name}) to Base64...`);
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Convert to Base64 in chunks to avoid "Maximum call stack size exceeded"
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.slice(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
      }
      const base64 = btoa(binary);
      console.log(`[Client] File ${index + 1} converted in ${Date.now() - fileStart}ms, Base64 size: ${(base64.length / 1024 / 1024).toFixed(2)}MB`);
      
      return {
        name: file.name,
        data: base64, // Don't add data: prefix, server will handle it
      };
    })
  );
  
  const totalBase64Size = base64Files.reduce((sum, f) => sum + f.data.length, 0);
  const jsonPayload = JSON.stringify({ files: base64Files });
  const payloadSize = new Blob([jsonPayload]).size;
  
  console.log(`[Client] All files converted to Base64. Total Base64 size: ${(totalBase64Size / 1024 / 1024).toFixed(2)}MB`);
  console.log(`[Client] JSON payload size: ${(payloadSize / 1024 / 1024).toFixed(2)}MB`);
  console.log(`[Client] Sending to /api/merge-base64...`);
  console.log(`[Client] Request URL: ${window.location.origin}/api/merge-base64`);
  
  // Amplify seems to have a very strict body size limit (possibly < 500KB)
  // Test with smaller payload first
  const MAX_PAYLOAD_SIZE = 400 * 1024; // 400KB (very conservative - seems like even 420KB fails)
  
  if (payloadSize > MAX_PAYLOAD_SIZE) {
    console.error(`[Client] Payload too large (${(payloadSize / 1024).toFixed(2)}KB > ${(MAX_PAYLOAD_SIZE / 1024).toFixed(2)}KB)`);
    throw new Error(`Files are too large to upload via Base64. Payload size: ${(payloadSize / 1024).toFixed(2)}KB. Amplify appears to have a very strict body size limit. Please try with smaller files (< 200KB each) or we need to use S3/Lambda functions.`);
  }
  
  console.log(`[Client] Payload size ${(payloadSize / 1024).toFixed(2)}KB is within limit, proceeding...`);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.error(`[Client] Base64 request timeout after 30 seconds`);
    controller.abort();
  }, 30000);
  
  try {
    const requestStart = Date.now();
    console.log(`[Client] Starting fetch to /api/merge-base64 with ${(payloadSize / 1024 / 1024).toFixed(2)}MB payload...`);
    const response = await fetch('/api/merge-base64', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: jsonPayload,
      signal: controller.signal,
    });
    console.log(`[Client] Fetch completed in ${Date.now() - requestStart}ms, status: ${response.status}`);
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to merge PDFs');
    }
    
    const result = await response.json();
    // Remove data: prefix if present
    const base64Data = result.data.replace(/^data:application\/pdf;base64,/, '').replace(/^data:.*;base64,/, '');
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    console.log(`[Client] Base64 merge successful in ${Date.now() - startTime}ms`);
    return new Blob([bytes], { type: 'application/pdf' });
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out after 30 seconds');
    }
    throw error;
  }
}

async function mergePDFsFormData(files: File[]): Promise<Blob> {
  const startTime = Date.now();
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  
  console.log(`[Client] Using FormData method for ${files.length} files, ${(totalSize / 1024 / 1024).toFixed(2)}MB total`);
  
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

