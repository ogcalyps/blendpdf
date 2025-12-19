/**
 * Access Amplify Secrets at runtime
 * Amplify Secrets are available via environment variables with a specific prefix
 * or through the Amplify runtime API
 */

/**
 * Get a secret value from Amplify Secrets
 * Secrets are available as environment variables with format: AMPLIFY_SECRET_<name>
 * Or we can try the standard env var approach
 */
export function getAmplifySecret(name: string): string | undefined {
  // Try different possible formats
  const possibleNames = [
    `AMPLIFY_SECRET_${name}`,
    `AMPLIFY_${name}`,
    `_${name}`, // User's format
    name, // Direct name
  ];

  for (const envName of possibleNames) {
    const value = process.env[envName];
    if (value) {
      console.log(`[getAmplifySecret] Found ${name} as ${envName}`);
      return value;
    }
  }

  return undefined;
}

/**
 * Get S3 bucket name from Amplify Secrets or env vars
 */
export function getS3BucketName(): string {
  // Try Amplify Secrets first (exact names as shown in Secret management)
  const secretBucket = process.env._AWS_S3_BUCKET_NAME ||  // Amplify Secrets format
                       getAmplifySecret('AWS_S3_BUCKET_NAME') || 
                       getAmplifySecret('S3_BUCKET_NAME') ||
                       getAmplifySecret('BUCKET_NAME');
  
  if (secretBucket) {
    return secretBucket;
  }

  // Try other environment variable formats
  const envBucket = process.env.AMAZON_S3_BUCKET_NAME || 
                    process.env.AWS_S3_BUCKET_NAME;
  
  if (envBucket) {
    return envBucket;
  }

  // Fallback to hardcoded
  return 'blendpdf-uploads';
}

/**
 * Get AWS credentials from Amplify Secrets or env vars
 */
export function getAWSCredentials(): {
  accessKeyId?: string;
  secretAccessKey?: string;
  region: string;
} {
  // Check Amplify Secrets first (exact names as shown in Secret management)
  const region = process.env._AWS_REGION ||  // Amplify Secrets format (first priority)
                 getAmplifySecret('AWS_REGION') || 
                 process.env.AMAZON_REGION ||
                 process.env.AWS_REGION || 
                 process.env.AWS_DEFAULT_REGION || 
                 'eu-north-1';

  const accessKeyId = process.env._AWS_ACCESS_KEY_ID ||  // Amplify Secrets format (first priority)
                      getAmplifySecret('AWS_ACCESS_KEY_ID') ||
                      process.env.AMAZON_ACCESS_KEY_ID ||
                      process.env.AWS_ACCESS_KEY_ID;

  const secretAccessKey = process.env._AWS_SECRET_ACCESS_KEY ||  // Amplify Secrets format (first priority)
                          getAmplifySecret('AWS_SECRET_ACCESS_KEY') ||
                          process.env.AMAZON_SECRET_ACCESS_KEY ||
                          process.env.AWS_SECRET_ACCESS_KEY;

  return {
    region,
    ...(accessKeyId && secretAccessKey ? {
      accessKeyId,
      secretAccessKey,
    } : {}),
  };
}

