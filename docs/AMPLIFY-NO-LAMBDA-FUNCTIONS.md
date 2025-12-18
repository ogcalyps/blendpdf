# No Lambda Functions Found - Alternative Solutions

## Problem
- No Lambda log groups found
- API routes timing out
- No logs appearing

## What This Means

If there are **no Lambda log groups**, it means:
- Next.js API routes might be deployed as part of the main Next.js server
- They might be handled by Amplify's hosting compute (not separate Lambda functions)
- The timeout might be at the Amplify hosting level, not Lambda level

## Solution 1: Check Amplify Hosting Compute Logs

1. Go to **AWS Amplify Console** → Your app
2. **Monitoring** → **Hosting compute logs** (NOT "Access logs")
3. This is where Next.js API route logs should appear
4. Filter by time when you made the merge request
5. Look for: `MERGE_ROUTE_LOADED` or `========== MERGE API ROUTE CALLED ==========`

## Solution 2: Check the Amplify Log Group You Found

You found: `/aws/amplify/d4thw6hcta6re`

1. Click on the **most recent log stream**
2. Look for any logs related to:
   - `merge`
   - `api/merge`
   - `MERGE_ROUTE_LOADED`
   - Any errors or timeouts

## Solution 3: Configure Amplify for API Routes

If API routes aren't working, we might need to configure Amplify differently:

### Option A: Remove Standalone Output (Already Done)
- We disabled `output: 'standalone'` in `next.config.ts`
- This should help API routes work better

### Option B: Add Rewrites Configuration

Create or update `amplify.yml` to ensure API routes are handled:

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
      - .next/cache/**/*
```

### Option C: Check Amplify Build Settings

1. Go to **Amplify Console** → **App settings** → **Build settings**
2. Look for:
   - **"Function timeout"** - increase to 30 seconds
   - **"Build timeout"** - should be sufficient (usually 60+ minutes)
   - **"Compute"** settings - check memory and timeout

## Solution 4: Test if API Routes Are Deployed

1. **Test health endpoint:**
   ```
   https://your-domain.amplifyapp.com/api/health
   ```
   - If it works → API routes are deployed
   - If it doesn't → API routes aren't deployed correctly

2. **Check the build output:**
   - Go to Amplify → Deployments → Latest deployment
   - Check build logs
   - Look for: "Generating static pages" or "API routes"
   - Should see: `ƒ /api/merge`, `ƒ /api/health`, etc.

## Solution 5: Alternative Architecture

If Amplify can't handle long-running API routes:

### Option A: Use AWS Lambda Directly
- Create separate Lambda functions for merge/compress/split
- Call them from the frontend
- Bypass Next.js API routes entirely

### Option B: Use Background Jobs
- Queue merge operations
- Return immediately with job ID
- Poll for completion
- Requires additional infrastructure (SQS, etc.)

### Option C: Process in Chunks
- Split large merges into smaller batches
- Process sequentially
- Combine results
- Reduces memory and time per request

## Immediate Actions

1. **Check Hosting compute logs** in Amplify Console
2. **Test `/api/health`** endpoint - does it work?
3. **Check the log stream** you found - any merge-related logs?
4. **Try a very small merge** (2 files, < 1MB each) - does it work?

## What to Look For

In the log stream `/aws/amplify/d4thw6hcta6re`:

- ✅ **Good signs:**
  - Logs containing "merge" or "api"
  - Any error messages
  - Timeout errors

- ❌ **Bad signs:**
  - No logs at all when making merge request
  - Only build/deployment logs
  - No API route logs

## Next Steps

1. Click on the most recent log stream in `/aws/amplify/d4thw6hcta6re`
2. Make a merge request
3. Check if ANY new logs appear
4. Share what you find - this will tell us if:
   - Requests are reaching the server
   - Where they're failing
   - What the actual error is

