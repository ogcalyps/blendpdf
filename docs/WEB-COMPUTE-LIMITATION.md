# AWS Amplify WEB_COMPUTE Timeout Limitation

## The Problem

- No Lambda functions are created, even with `output: 'standalone'`
- API routes are handled by Amplify's hosting compute
- Default 10-second timeout can't be changed
- No timeout settings in Amplify Console

## Why This Happens

For Next.js on Amplify with **WEB_COMPUTE** platform:
- API routes run in the same compute environment as the Next.js app
- They're NOT deployed as separate Lambda functions
- The timeout is hardcoded at ~10 seconds
- There's no way to increase it in the Amplify Console

## Solutions

### Option 1: Process Files in Smaller Chunks (Recommended)

Instead of processing all files at once, process them in batches:

1. **Split large merges into smaller batches**
2. **Process 2-3 files at a time**
3. **Merge the results**
4. **This keeps each request under 10 seconds**

### Option 2: Use AWS Lambda Directly

Create separate Lambda functions outside of Amplify:

1. **Create Lambda functions** for merge/compress/split
2. **Call them from the frontend** directly
3. **Configure timeout to 30 seconds** in Lambda
4. **Bypass Amplify's API routes entirely**

### Option 3: Use Background Jobs

Implement a queue-based system:

1. **Upload files** → Return immediately with job ID
2. **Process in background** (Lambda function with longer timeout)
3. **Poll for completion** from frontend
4. **Download when ready**

### Option 4: Switch to Different Hosting

For API routes that need >10 seconds:
- **Vercel** (supports up to 60 seconds on Pro)
- **AWS Lambda directly** (up to 15 minutes)
- **AWS App Runner** (configurable timeouts)

## Immediate Workaround: Smaller Files

For now, you can:
1. **Limit file sizes** to < 5MB each
2. **Limit number of files** to 2-3 at a time
3. **Process in batches** if merging many files

This should keep requests under 10 seconds.

## Next Steps

1. **Try merging 2 very small files** (< 1MB each) - does it work?
2. **If yes** → The issue is file size/time
3. **If no** → Different issue (routing, etc.)

Let me know what happens with small files!

