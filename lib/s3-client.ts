import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Initialize S3 client
// Use IAM role credentials (default) or explicit credentials if provided
// Amplify Lambda functions use the execution role by default
const s3Client = new S3Client({
  region: process.env._AWS_REGION || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'eu-north-1',
  // Only set credentials if explicitly provided (for local dev)
  // In Amplify, the Lambda execution role will be used automatically
  ...(process.env._AWS_ACCESS_KEY_ID && process.env._AWS_SECRET_ACCESS_KEY
    ? {
        credentials: {
          accessKeyId: process.env._AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || '',
          secretAccessKey: process.env._AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || '',
        },
      }
    : {}),
});

// Initialize bucket name
// Since Amplify env vars don't work in Lambda, we'll try multiple approaches
function getBucketName(): string {
  // Try environment variables first
  let bucketName = process.env._AWS_S3_BUCKET_NAME || process.env.AWS_S3_BUCKET_NAME || '';
  
  // If not set, use hardcoded value (you can change this)
  // TODO: Once Amplify Secrets work, remove this hardcode
  if (!bucketName) {
    bucketName = 'blendpdf-uploads'; // Your bucket name
    console.warn('S3 Bucket Name: Using hardcoded value because environment variable not available');
  }
  
  // Debug logging
  console.log('S3 Bucket Name Check:', {
    'bucketName': bucketName,
    '_AWS_S3_BUCKET_NAME': process.env._AWS_S3_BUCKET_NAME || 'NOT SET',
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
    throw new Error('_AWS_S3_BUCKET_NAME or AWS_S3_BUCKET_NAME environment variable is not set. Please check Amplify environment variables and redeploy.');
  }

  const key = `${UPLOAD_PREFIX}${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${fileName}`;
  
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });
  
  console.log(`[generateUploadUrl] Using bucket: ${BUCKET_NAME}, key: ${key}`);

  const url = await getSignedUrl(s3Client, command, { expiresIn: EXPIRES_IN });
  
  return JSON.stringify({ url, key });
}

/**
 * Download a file from S3
 */
export async function downloadFromS3(key: string): Promise<ArrayBuffer> {
  const BUCKET_NAME = getBucketName();
  
  if (!BUCKET_NAME) {
    throw new Error('_AWS_S3_BUCKET_NAME or AWS_S3_BUCKET_NAME environment variable is not set');
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

