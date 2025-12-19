import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getAWSCredentials, getS3BucketName } from './amplify-secrets';

// Initialize S3 client
// Use IAM role credentials (default) or explicit credentials from Secrets/env vars
// Amplify Lambda functions use the execution role by default
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

// Get bucket name from Amplify Secrets or fallback
function getBucketName(): string {
  const bucketName = getS3BucketName();
  
  // Debug logging
  console.log('S3 Bucket Name Check:', {
    'bucketName': bucketName,
    'source': bucketName === 'blendpdf-uploads' ? 'hardcoded fallback' : 'Secrets/env var',
    '_AWS_S3_BUCKET_NAME': process.env._AWS_S3_BUCKET_NAME || 'NOT SET',  // Amplify Secrets format (first priority)
    'AMAZON_S3_BUCKET_NAME': process.env.AMAZON_S3_BUCKET_NAME || 'NOT SET',
    'AWS_S3_BUCKET_NAME': process.env.AWS_S3_BUCKET_NAME || 'NOT SET',
    'AMPLIFY_SECRET_AWS_S3_BUCKET_NAME': process.env.AMPLIFY_SECRET_AWS_S3_BUCKET_NAME || 'NOT SET',
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

