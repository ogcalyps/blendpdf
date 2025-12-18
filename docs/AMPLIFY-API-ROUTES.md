# AWS Amplify Next.js API Routes Configuration

## Issue: Requests Stuck in "Pending" State

If merge requests show as `(pending)` in the Network tab and no logs appear, this is likely an **AWS Amplify configuration issue**.

## Root Cause

AWS Amplify has specific limitations for Next.js API routes:
- **Default timeout: 10 seconds** (very short!)
- **Request size limits**
- **Cold start delays**
- **Logging configuration**

## Solutions

### 1. Check AWS Amplify Function Timeout

1. Go to **AWS Amplify Console** → Your app
2. **App settings** → **Build settings**
3. Look for **Function timeout** or **Lambda timeout**
4. **Set to maximum: 30 seconds**

### 2. Verify API Routes Are Deployed

Check that API routes are actually deployed:
1. Go to your deployed site
2. Visit: `https://your-domain.amplifyapp.com/api/health`
3. Should return: `{"status":"ok","timestamp":"...","runtime":"nodejs"}`

If this doesn't work, API routes aren't deployed correctly.

### 3. Check Request Size

Large file uploads might exceed Amplify limits:
- **Check file sizes** in browser console
- **Try with smaller files first** (1-2MB each)
- **Check total size** (should be < 100MB)

### 4. Enable CloudWatch Logs

1. Go to **AWS Console** → **CloudWatch**
2. **Log groups** → Search for your Amplify app
3. Look for log groups like:
   - `/aws/amplify/blendpdf`
   - `/aws/lambda/amplify-blendpdf-*`

### 5. Check Amplify Build Configuration

Verify `amplify.yml` is correct:
- Should build Next.js app
- Should include API routes in output
- Should not exclude `.next` directory incorrectly

## Debugging Steps

### Step 1: Test Health Endpoint
```bash
curl https://your-domain.amplifyapp.com/api/health
```
Should return JSON with status "ok"

### Step 2: Check Browser Network Tab
- Look at the `/api/merge` request
- Check **Request Headers**
- Check **Request Payload** size
- Check if it's actually sending (not blocked)

### Step 3: Check AWS Amplify Logs
- Go to **Monitoring** → **Hosting compute logs**
- Filter by time when you made the request
- Look for ANY logs (even errors)

### Step 4: Check CloudWatch Directly
- AWS Console → CloudWatch → Log groups
- Find your Amplify app's log group
- Check recent log streams

## Common Issues

### Issue 1: Request Never Reaches Server
**Symptoms:** Request stuck in "pending", no logs anywhere
**Causes:**
- Amplify timeout too short
- Request size too large
- API route not deployed
- CORS issue (unlikely for same-origin)

**Fix:**
- Increase timeout to 30 seconds
- Reduce file sizes
- Verify API routes are in build output

### Issue 2: Request Times Out Immediately
**Symptoms:** Request fails after 10 seconds, no server logs
**Causes:**
- Default 10-second timeout
- Cold start taking too long
- Function not configured correctly

**Fix:**
- Set `maxDuration = 30` in route.ts (already done)
- Configure Amplify function timeout to 30 seconds
- Check function configuration in Amplify console

### Issue 3: Logs Not Appearing
**Symptoms:** Request completes but no logs in CloudWatch
**Causes:**
- CloudWatch logging not enabled
- Wrong log group
- Logs delayed

**Fix:**
- Enable CloudWatch logging in Amplify
- Check correct log group
- Wait a few minutes for logs to appear

## Next.js API Routes in Amplify

Next.js API routes in Amplify are deployed as **Lambda@Edge** or **Lambda functions**.

### Configuration Required:

1. **Route Configuration:**
   ```typescript
   export const maxDuration = 30; // ✅ Already set
   export const runtime = 'nodejs'; // ✅ Already set
   ```

2. **Amplify Configuration:**
   - Function timeout: 30 seconds
   - Memory: 1024 MB (default, should be enough)
   - Logging: Enabled

3. **Build Output:**
   - API routes should be in `.next/server/app/api/`
   - Should be included in deployment

## Testing Checklist

- [ ] Health endpoint works: `/api/health`
- [ ] Small merge works (2 files, < 5MB each)
- [ ] Logs appear in CloudWatch
- [ ] Request completes (not stuck in pending)
- [ ] Error messages are clear

## If Nothing Works

1. **Check Amplify Console** → **App settings** → **Environment variables**
   - Ensure no conflicting settings
   - Check for any error messages

2. **Try redeploying:**
   - Push a small change
   - Trigger a new build
   - Check if API routes are included

3. **Contact AWS Support:**
   - If API routes aren't working at all
   - If timeout can't be increased
   - If logs are completely missing

