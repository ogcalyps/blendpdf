# Using Amplify Secrets Instead of Environment Variables

## The Problem

You were right! Amplify has a **Secrets** feature that's separate from environment variables. Secrets are designed for sensitive data and are available at runtime, whereas regular environment variables might only be available at build time.

## How Amplify Secrets Work

Amplify Secrets are accessed via environment variables with a specific format. The code now checks for:

1. **Amplify Secrets format**: `AMPLIFY_SECRET_<name>`
2. **Standard env vars**: `_AWS_*` or `AWS_*`
3. **Fallback**: Hardcoded values

## Setting Up Secrets in Amplify

### Step 1: Go to Amplify Secrets

1. **AWS Amplify Console** → Your app
2. **App settings** → **Secrets** (or **Environment variables** → **Secrets** tab)
3. Click **Add secret**

### Step 2: Add Your Secrets

Add these secrets (use the exact names):

- `AWS_S3_BUCKET_NAME` = `blendpdf-uploads` (or your bucket name)
- `AWS_ACCESS_KEY_ID` = Your access key (if not using IAM role)
- `AWS_SECRET_ACCESS_KEY` = Your secret key (if not using IAM role)
- `AWS_REGION` = `eu-north-1` (or your region)

**Note**: If you're using IAM roles (recommended), you only need `AWS_S3_BUCKET_NAME`.

### Step 3: How the Code Accesses Them

The code in `lib/amplify-secrets.ts` checks for secrets in this order:

1. `AMPLIFY_SECRET_AWS_S3_BUCKET_NAME`
2. `AMPLIFY_SECRET_S3_BUCKET_NAME`
3. `AMPLIFY_SECRET_BUCKET_NAME`
4. `_AWS_S3_BUCKET_NAME` (env var)
5. `AWS_S3_BUCKET_NAME` (env var)
6. Hardcoded fallback: `blendpdf-uploads`

## Recommended: Use IAM Role + Secrets for Bucket Name

**Best approach**:
1. ✅ **Use IAM role** for S3 access (no access keys needed)
2. ✅ **Use Secret** for bucket name only

This is more secure and simpler.

### Setup:

1. **Add S3 permissions to Lambda execution role** (see `docs/IAM-ROLE-SETUP.md`)
2. **Add Secret**: `AWS_S3_BUCKET_NAME` = `blendpdf-uploads`
3. **Done!** No access keys needed.

## Testing

After adding secrets and redeploying:

1. Check logs - you should see:
   ```
   S3 Bucket Name Check: {
     bucketName: 'blendpdf-uploads',
     source: 'Secrets/env var'  // Not 'hardcoded fallback'
   }
   ```

2. Try merging - should work!

## Debugging

The code logs which secrets/env vars are found. Check CloudWatch logs for:
- `[getAmplifySecret] Found AWS_S3_BUCKET_NAME as AMPLIFY_SECRET_AWS_S3_BUCKET_NAME`
- Or which format was used

If you see "hardcoded fallback", the secrets aren't being read correctly.

