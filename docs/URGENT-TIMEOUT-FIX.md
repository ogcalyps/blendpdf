# URGENT: Fix AWS Amplify Timeout - Step by Step

## The Problem
- Merge endpoint times out after ~10 seconds
- No logs appear (request killed before logging)
- Request stuck in "pending" then fails

## Root Cause
**AWS Amplify has a 10-second default timeout** that's killing your requests before they can complete.

## IMMEDIATE FIX (Do This Now)

### Step 1: Increase Lambda Function Timeout

**Option A: Through AWS Lambda Console (Recommended)**

1. Go to [AWS Lambda Console](https://console.aws.amazon.com/lambda)
2. **Functions** → Search for functions containing: `amplify-blendpdf` or `blendpdf`
3. Look for functions with names like:
   - `amplify-blendpdf-{hash}-api-merge-{hash}`
   - `amplify-blendpdf-{hash}-api-*`
4. Click on the function
5. Go to **Configuration** tab → **General configuration**
6. Click **Edit** on **Timeout**
7. **Change from 10 seconds to 30 seconds**
8. Click **Save**

**Option B: Through AWS Amplify Console**

1. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify)
2. Select your app: **blendpdf**
3. Go to **App settings** → **Build settings**
4. Look for **"Function timeout"** or **"Lambda timeout"**
5. If you see it, change to **30 seconds**
6. If you DON'T see it, you MUST use Option A (Lambda Console)

### Step 2: Verify the Fix

1. **Wait 2-3 minutes** for changes to propagate
2. **Test the health endpoint:**
   ```
   https://your-domain.amplifyapp.com/api/health
   ```
   Should return: `{"status":"ok",...}`

3. **Try a small merge** (2 files, < 5MB total)
4. **Check CloudWatch logs** - you should now see logs!

## If You Can't Find the Lambda Function

### Find It Using CloudWatch

1. Go to [CloudWatch Console](https://console.aws.amazon.com/cloudwatch)
2. **Log groups** → Search for: `amplify` or `blendpdf`
3. Look for log groups like:
   - `/aws/amplify/blendpdf-*/api/merge`
   - `/aws/lambda/amplify-blendpdf-*`
4. Click on a log group
5. Look at the log stream name - it will contain the function name
6. Copy the function name and go to Lambda Console to find it

### Alternative: Check Amplify Build Logs

1. Go to Amplify Console → Your app
2. **Deployments** → Click latest deployment
3. **Build logs** → Look for Lambda function creation
4. Note the function names created
5. Use those names in Lambda Console

## What Changed in Code

1. ✅ **Disabled `output: 'standalone'`** - This was causing API route issues
2. ✅ **Added aggressive logging** - Logs immediately when route loads
3. ✅ **Added health endpoint** - Test if API routes work at all
4. ✅ **Enhanced error messages** - Better debugging info

## After Fixing Timeout

### Test Checklist

- [ ] Health endpoint works: `/api/health`
- [ ] Small merge completes (2 files, < 5MB)
- [ ] Logs appear in CloudWatch
- [ ] No timeout errors
- [ ] Request completes successfully

### Expected Logs (After Fix)

You should see in CloudWatch:
```
MERGE_ROUTE_LOADED
========== MERGE API ROUTE CALLED ==========
[merge-xxx] MERGE REQUEST INITIATED
[merge-xxx] Received 2 files
[merge-xxx] Starting PDF merge...
[merge-xxx] Merge completed!
```

## If Still Not Working

### Check These:

1. **Is the health endpoint working?**
   - If NO → API routes aren't deployed correctly
   - If YES → Timeout is the issue (increase it)

2. **Are logs appearing at all?**
   - If NO → Check CloudWatch log groups
   - If YES → Check where it's failing

3. **What's the exact error?**
   - Check browser Network tab → Click the failed request
   - Check Response tab for error message
   - Check Timing tab to see where it fails

## Important Notes

- **The timeout MUST be increased in AWS Console** - it can't be done in code
- **Changes take 2-3 minutes to propagate**
- **Each API route might have its own Lambda function** - check all of them
- **Default is 10 seconds** - this is way too short for PDF processing

## Still Stuck?

If after increasing timeout to 30 seconds you still have issues:

1. **Check file sizes** - Are they too large?
2. **Try with 1-2 small files first** - Does it work?
3. **Check CloudWatch directly** - Are there ANY logs?
4. **Contact AWS Support** - They can help with Amplify-specific issues

