# Merge Endpoint Issue - Health Works But Merge Doesn't

## ✅ Good News
- Health endpoint works: `/api/health` returns JSON
- API routes ARE deployed correctly
- API routes CAN be reached

## ❌ Problem
- Merge endpoint produces no logs
- Request likely timing out or not reaching the route handler

## Why This Happens

Since health works but merge doesn't, the issue is likely:

1. **File upload size** - Large files take time to upload/process
2. **Amplify timeout** - 10-second default timeout kills the request
3. **Request processing** - Merge takes longer than health check

## Next Steps

### Step 1: Check Browser Network Tab

1. Open BlendPDF site
2. Open Developer Tools (F12)
3. Go to **Network** tab
4. Upload 2 small PDFs (< 1MB each)
5. Click "Merge"
6. Look at the `/api/merge` request:
   - **Status code?** (200, 404, 500, pending?)
   - **Status text?** (OK, Failed, Timeout?)
   - **Duration?** (How long before it fails?)
   - **Request size?** (How big is the payload?)
   - **Response?** (Any error message?)

### Step 2: Test with Very Small Files

Try merging 2 very small PDFs (< 100KB each):
- If this works → Issue is file size/timeout
- If this doesn't work → Issue is with merge route itself

### Step 3: Check Amplify Timeout Settings

Since health works, the timeout is likely killing merge requests:

1. **Amplify Console** → **App settings** → **Build settings**
2. Look for **"Function timeout"** or **"Compute timeout"**
3. Change to **30 seconds** if you find it

## Possible Solutions

### Solution 1: Re-enable Standalone Output

We disabled `output: 'standalone'` but Amplify might need it for large file uploads:

1. Edit `next.config.ts`
2. Uncomment: `output: 'standalone'`
3. Redeploy

### Solution 2: Increase Amplify Timeout

The 10-second default is too short for file uploads:
- Need to find timeout setting in Amplify Console
- Increase to 30 seconds

### Solution 3: Add Request Size Validation Earlier

Add validation before processing to fail fast:
- Check file sizes immediately
- Return error if too large
- This will at least produce logs

## What to Share

Please share:
1. **Network tab results** - What happens to the `/api/merge` request?
2. **File sizes** - How big are the PDFs you're trying to merge?
3. **Timeout duration** - How long before it fails? (10 seconds = Amplify timeout)

