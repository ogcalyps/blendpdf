# How to View Logs - Step by Step

## ✅ You Found the Right Place!

You're in: **AWS Amplify Console** → **Monitoring** → **Hosting compute logs**

## Step-by-Step Instructions

### Step 1: Click the Log Stream Link

In the table, you should see:
- **Branch name:** main
- **CloudWatch log streams:** A clickable link

**Click on that link** - it will open the actual log stream in CloudWatch.

### Step 2: Make a Test Request

1. Open your BlendPDF site in another tab
2. Upload 2 small PDF files (< 1MB each)
3. Click "Merge PDFs"
4. **Don't close the log stream tab**

### Step 3: Check for Logs

In the log stream, you should see:

**✅ Good signs (request reached server):**
- `========== MERGE API ROUTE CALLED ==========`
- `[merge-xxxxx] MERGE REQUEST INITIATED`
- `[merge-xxxxx] Received X files`
- Any error messages

**❌ Bad signs (request didn't reach server):**
- No new logs at all
- Only old build/deployment logs
- Request stuck in browser (pending state)

### Step 4: What to Look For

**If you see logs:**
- Check for timeout errors
- Check for file size errors
- Check for any error messages
- Share the error message with me

**If you DON'T see logs:**
- The request isn't reaching the server
- Likely a timeout at Amplify level (10 seconds)
- Need to increase timeout in Amplify settings

## Common Log Patterns

### Pattern 1: Request Reaches Server
```
[2025-12-18T...] ========== MERGE API ROUTE CALLED ==========
[2025-12-18T...] [merge-xxxxx] MERGE REQUEST INITIATED
[2025-12-18T...] [merge-xxxxx] Received 2 files
[2025-12-18T...] [merge-xxxxx] Starting PDF merge...
```

### Pattern 2: Timeout Error
```
[2025-12-18T...] [merge-xxxxx] MERGE REQUEST INITIATED
[2025-12-18T...] [merge-xxxxx] Received 2 files
[2025-12-18T...] Task timed out after 10.00 seconds
```

### Pattern 3: No Logs (Request Never Reached Server)
- No new entries in log stream
- Request stuck in browser Network tab as "pending"
- This means Amplify is timing out before the request reaches Next.js

## Next Steps Based on What You Find

### If You See Logs:
1. Copy the error message
2. Check the timestamp - did it timeout?
3. Share the logs with me

### If You Don't See Logs:
1. The timeout is happening at Amplify level (before Next.js)
2. Need to increase timeout in Amplify Console
3. Go to: **App settings** → **Build settings** → Look for timeout

### If You See Timeout Errors:
1. The request is reaching the server but timing out
2. Either:
   - Files are too large
   - Processing is too slow
   - Timeout is too short (10 seconds)
3. Solution: Increase timeout to 30 seconds

## Quick Test

Before checking logs, test if API routes work at all:

Visit: `https://your-domain.amplifyapp.com/api/health`

- ✅ Returns JSON → API routes work, just timeout issue
- ❌ 404 or error → API routes not deployed correctly

