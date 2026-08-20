import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getAWSCredentials, getS3BucketName } from './aws-config';

// Initialize S3 client
// Use IAM role credentials (default) or explicit credentials from environment variables
let s3Client: S3Client;

function initializeS3Client() {
  const awsConfig = getAWSCredentials();
  
  console.log('[initializeS3Client] Config:', {
    region: awsConfig.region,
    hasCredentials: !!(awsConfig.accessKeyId && awsConfig.secretAccessKey),
  });

  // If we have explicit credentials, use them
  // Otherwise, let AWS SDK use the default credential chain (IAM role)
  if (awsConfig.accessKeyId && awsConfig.secretAccessKey) {
    console.log('[initializeS3Client] Using explicit credentials');
    s3Client = new S3Client({
      region: awsConfig.region,
      credentials: {
        accessKeyId: awsConfig.accessKeyId,
        secretAccessKey: awsConfig.secretAccessKey,
      },
    });
  } else {
    console.log('[initializeS3Client] Using default credential chain (IAM role)');
    // No credentials provided - AWS SDK will use default credential chain
    // This includes: IAM role, environment variables, etc.
    s3Client = new S3Client({
      region: awsConfig.region,
    });
  }
  
  return s3Client;
}

// Initialize on module load
s3Client = initializeS3Client();

// Export S3 client for use in API routes
export { s3Client };

// Get bucket name from environment variables or fallback
export function getBucketName(): string {
  const bucketName = getS3BucketName();
  
  // Debug logging
  console.log('S3 Bucket Name Check:', {
    'bucketName': bucketName,
    'source': bucketName ? 'env var' : 'NOT SET (S3 routes disabled)',
    'AMAZON_S3_BUCKET_NAME': process.env.AMAZON_S3_BUCKET_NAME || 'NOT SET',
    'AWS_S3_BUCKET_NAME': process.env.AWS_S3_BUCKET_NAME || 'NOT SET',
  });
  
  return bucketName;
}

const UPLOAD_PREFIX = 'uploads/';
const EXPIRES_IN = 3600; // 1 hour

/**
 * Generate a presigned URL for uploading a file to S3
 */
export async function generateUploadUrl(fileName: string, contentType: string = 'application/pdf'): Promise<string> {
  const BUCKET_NAME = getBucketName();
  
  if (!BUCKET_NAME) {
    throw new Error('AWS_S3_BUCKET_NAME environment variable is not set. Please check your environment variables.');
  }

  const key = `${UPLOAD_PREFIX}${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${fileName}`;
  
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
    Metadata: {
      'original-filename': fileName,
    },
  });
  
  console.log(`[generateUploadUrl] Using bucket: ${BUCKET_NAME}, key: ${key}, contentType: ${contentType}`);

  // Generate presigned URL
  // Note: ContentType in PutObjectCommand should automatically be included in signature
  // But we need to ensure the browser sends the exact same Content-Type
  const url = await getSignedUrl(s3Client, command, { 
    expiresIn: EXPIRES_IN,
  });
  
  return JSON.stringify({ url, key });
}

/**
 * Download a file from S3
 */
export async function downloadFromS3(key: string): Promise<ArrayBuffer> {
  const BUCKET_NAME = getBucketName();
  
  if (!BUCKET_NAME) {
    throw new Error('AWS_S3_BUCKET_NAME environment variable is not set');
  }

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });
  
  console.log(`[downloadFromS3] Using bucket: ${BUCKET_NAME}, key: ${key}`);

  const response = await s3Client.send(command);
  
  if (!response.Body) {
    throw new Error('No body in S3 response');
  }

  // Convert stream to ArrayBuffer
  // For Node.js, Body is a Readable stream
  const chunks: Buffer[] = [];
  
  // @ts-ignore - Body can be a stream
  for await (const chunk of response.Body) {
    chunks.push(Buffer.from(chunk));
  }

  // Combine chunks into single Buffer, then convert to ArrayBuffer
  const buffer = Buffer.concat(chunks);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

/**
 * Delete a file from S3
 */
export async function deleteFromS3(key: string): Promise<void> {
  const BUCKET_NAME = getBucketName();
  
  if (!BUCKET_NAME) {
    return; // Silently fail if bucket not configured
  }

  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
  } catch (error) {
    console.error(`Failed to delete ${key} from S3:`, error);
    // Don't throw - cleanup failures shouldn't break the flow
  }
}

/**
 * Delete multiple files from S3
 */
export async function deleteMultipleFromS3(keys: string[]): Promise<void> {
  await Promise.all(keys.map(key => deleteFromS3(key)));
}

/**
 * Delete abandoned uploads older than maxAgeMs from the uploads/ prefix.
 *
 * Backs the "files are deleted within 1 hour" privacy promise for uploads
 * that never reached the merge step (user closed the tab, errors, etc.).
 * Deletes at most 100 objects per invocation. Errors are swallowed and
 * logged — this is best-effort cleanup and must never break a request.
 */
export async function deleteStaleUploads(maxAgeMs: number = 3600000): Promise<number> {
  const BUCKET_NAME = getBucketName();

  if (!BUCKET_NAME) {
    return 0;
  }

  try {
    const cutoff = Date.now() - maxAgeMs;

    const list = await s3Client.send(new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: UPLOAD_PREFIX,
      MaxKeys: 1000,
    }));

    const stale = (list.Contents || [])
      .filter(obj => obj.Key && obj.LastModified && obj.LastModified.getTime() < cutoff)
      .slice(0, 100)
      .map(obj => ({ Key: obj.Key! }));

    if (stale.length === 0) {
      return 0;
    }

    await s3Client.send(new DeleteObjectsCommand({
      Bucket: BUCKET_NAME,
      Delete: { Objects: stale, Quiet: true },
    }));

    console.log(`[deleteStaleUploads] Deleted ${stale.length} stale upload(s) older than ${Math.round(maxAgeMs / 60000)}min`);
    return stale.length;
  } catch (error) {
    console.error('[deleteStaleUploads] Failed to clean up stale uploads:', error);
    return 0;
  }
}

