/**
 * Get AWS credentials and S3 configuration from environment variables
 */

/**
 * Get S3 bucket name from environment variables
 */
export function getS3BucketName(): string {
  const bucketName = process.env.AWS_S3_BUCKET_NAME || 
                    process.env.AMAZON_S3_BUCKET_NAME;
  
  if (bucketName) {
    return bucketName;
  }

  // No fallback on purpose: silently defaulting to a bucket name that belongs to
  // someone else's deployment is worse than an explicit failure. Set
  // AWS_S3_BUCKET_NAME to enable the S3-backed routes.
  return '';
}

/**
 * Get AWS credentials from environment variables
 */
export function getAWSCredentials(): {
  accessKeyId?: string;
  secretAccessKey?: string;
  region: string;
} {
  const region = process.env.AWS_REGION || 
                 process.env.AWS_DEFAULT_REGION || 
                 'eu-north-1';

  const accessKeyId = process.env.AWS_ACCESS_KEY_ID ||
                     process.env.AMAZON_ACCESS_KEY_ID;

  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY ||
                         process.env.AMAZON_SECRET_ACCESS_KEY;

  console.log('[getAWSCredentials] Result:', {
    hasRegion: !!region,
    hasAccessKey: !!accessKeyId,
    hasSecretKey: !!secretAccessKey,
    region: region,
    accessKeyIdPrefix: accessKeyId ? `${accessKeyId.substring(0, 8)}...` : 'NOT SET',
    secretKeyPrefix: secretAccessKey ? `${secretAccessKey.substring(0, 8)}...` : 'NOT SET',
  });

  return {
    region,
    ...(accessKeyId && secretAccessKey ? {
      accessKeyId,
      secretAccessKey,
    } : {}),
  };
}
