# Fixing AWS Amplify Timeout Issues

## Problem
- Merge endpoint times out
- No logs appearing
- Request stuck in "pending" state

## Root Cause
AWS Amplify has a **default 10-second timeout** for serverless functions. Next.js API routes are deployed as Lambda functions, and if the timeout isn't increased, requests will fail before they can complete.

## Solution: Increase Function Timeout in AWS Amplify

### Step 1: Access Amplify Console
1. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify)
2. Select your app: **blendpdf**

### Step 2: Find Function Timeout Settings
**Option A: Build Settings**
1. Go to **App settings** → **Build settings**
2. Look for **"Function timeout"** or **"Lambda timeout"**
3. Change from **10 seconds** to **30 seconds** (maximum)

**Option B: Environment Variables**
1. Go to **App settings** → **Environment variables**
2. Look for any timeout-related variables
3. Add if missing: `AWS_LAMBDA_TIMEOUT=30`

**Option C: Custom Build Settings**
If the above don't work, you may need to configure this in the AWS Console directly:
1. Go to **AWS Lambda Console**
2. Find your Amplify-generated Lambda functions
3. Look for functions named like: `amplify-blendpdf-*-api-merge-*`
4. Go to **Configuration** → **General configuration**
5. Click **Edit** on **Timeout**
6. Set to **30 seconds**

### Step 3: Alternative - Remove Standalone Output
If timeout settings don't help, the `output: 'standalone'` in `next.config.ts` might be causing issues:

1. Edit `next.config.ts`
2. Comment out or remove: `output: 'standalone'`
3. Redeploy

**Note:** This might affect how Amplify deploys your app, but API routes should work better.

## Verify the Fix

### Test 1: Health Endpoint
```bash
curl https://your-domain.amplifyapp.com/api/health
```
Should return: `{"status":"ok",...}`

### Test 2: Small Merge
1. Try merging 2 small PDFs (< 1MB each)
2. Check if it completes
3. Check CloudWatch logs for entries

### Test 3: Check Logs
1. Go to **AWS CloudWatch** → **Log groups**
2. Search for: `/aws/amplify/blendpdf` or `/aws/lambda/amplify-blendpdf`
3. Look for log streams with recent timestamps
4. You should see: `========== MERGE API ROUTE CALLED ==========`

## If Timeout Still Occurs

### Option 1: Reduce File Sizes
- Compress files before merging
- Split large merges into batches
- Limit to 5-10 files at a time

### Option 2: Use Streaming/Chunking
- Process files in chunks
- Stream responses instead of loading all in memory
- This requires code changes

### Option 3: Use Background Jobs
- Queue the merge operation
- Return immediately with a job ID
- Poll for completion
- This requires additional infrastructure

## Current Configuration

- **Next.js maxDuration**: 30 seconds ✅
- **Runtime**: nodejs ✅
- **Logging**: Enhanced ✅
- **Amplify Timeout**: **NEEDS TO BE SET TO 30 SECONDS** ⚠️

## Quick Checklist

- [ ] Increased Amplify function timeout to 30 seconds
- [ ] Tested `/api/health` endpoint
- [ ] Tried merge with small files (< 5MB total)
- [ ] Checked CloudWatch logs
- [ ] Verified request reaches server (logs appear)

## Still Not Working?

If after increasing timeout you still see no logs:
1. **Check if API routes are deployed**: Test `/api/health`
2. **Check CloudWatch directly**: AWS Console → CloudWatch → Log groups
3. **Check Amplify build logs**: Look for errors during build
4. **Try removing `output: 'standalone'`**: This might be the issue

