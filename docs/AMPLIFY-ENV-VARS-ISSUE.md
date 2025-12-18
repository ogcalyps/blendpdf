# Amplify Environment Variables Not Available in Lambda

## The Problem

Environment variables set in Amplify Console are **NOT being passed to Lambda functions**:
- ✅ Variables are set in Amplify Console
- ❌ Variables are NOT available in `process.env` in Lambda
- ❌ Only system AWS variables are available

## What the Logs Show

```
hasRegion: false
hasAccessKey: false
hasSecretKey: false
hasBucketName: false
```

But system variables ARE available:
- `AWS_REGION=eu-north-1` ✅
- `AWS_LAMBDA_FUNCTION_NAME` ✅
- etc.

## Why This Happens

Amplify environment variables set in the Console might:
1. **Only be available during build time** (not runtime)
2. **Need to be configured differently** for Lambda functions
3. **Require a specific Amplify configuration**

## Solutions

### Solution 1: Use Amplify Secrets (Recommended)

Amplify has a "Secrets" feature that's designed for sensitive data:

1. **Amplify Console** → **App settings** → **Secrets**
2. Add secrets:
   - `_AWS_ACCESS_KEY_ID`
   - `_AWS_SECRET_ACCESS_KEY`
   - `_AWS_S3_BUCKET_NAME`
3. These should be available at runtime

### Solution 2: Use IAM Role Instead of Access Keys

Instead of access keys, use the Lambda execution role:

1. **Amplify Console** → **App settings** → **IAM roles**
2. Attach S3 permissions to the execution role
3. Remove access key requirements from code

### Solution 3: Check Variable Scope

Make sure variables are set for the correct branch:
- Check if variables are set for "All branches" or specific branch
- Make sure you're testing on the correct branch

### Solution 4: Use Amplify CLI to Set Variables

Try setting variables via Amplify CLI instead of Console:

```bash
amplify env add
# Or
amplify configure project
```

## Immediate Test

Check if variables are available during build:
1. Look at build logs in Amplify
2. See if variables are available during `npm run build`
3. If yes → They're build-time only, need runtime solution

## Next Steps

1. **Try Amplify Secrets** (Solution 1)
2. **Or use IAM role** (Solution 2) - more secure anyway
3. **Check variable scope** (Solution 3)

Let me know which approach you want to try!

