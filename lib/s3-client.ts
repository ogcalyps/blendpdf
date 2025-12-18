import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'eu-north-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || '';
const UPLOAD_PREFIX = 'uploads/';
const EXPIRES_IN = 3600; // 1 hour

/**
 * Generate a presigned URL for uploading a file to S3
 */
export async function generateUploadUrl(fileName: string, contentType: string = 'application/pdf'): Promise<string> {
  if (!BUCKET_NAME) {
    throw new Error('AWS_S3_BUCKET_NAME environment variable is not set');
  }

  const key = `${UPLOAD_PREFIX}${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${fileName}`;
  
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const url = await getSignedUrl(s3Client, command, { expiresIn: EXPIRES_IN });
  
  return JSON.stringify({ url, key });
}

/**
 * Download a file from S3
 */
export async function downloadFromS3(key: string): Promise<ArrayBuffer> {
  if (!BUCKET_NAME) {
    throw new Error('AWS_S3_BUCKET_NAME environment variable is not set');
  }

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

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

