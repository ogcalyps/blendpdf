# Finding Merge API Logs in AWS Amplify

## Where to Look

### ❌ Wrong Location: Access Logs
The "Access logs" you're seeing are for **static file requests** (HTML, CSS, JS). They won't show API route logs.

### ✅ Correct Location: Hosting Compute Logs

1. **Go to AWS Amplify Console**
2. **Select your app** (blendpdf)
3. **Left sidebar** → **Monitoring** → **Hosting compute logs** (NOT "Access logs")
4. This is where Next.js API route logs appear

## What You Should See

When a merge request is made, you should see logs like:

```
[merge-1234567890-abc123] Merge request started
[merge-1234567890-abc123] Received 2 files
[merge-1234567890-abc123] File info: [{"name":"file1.pdf","size":1048576,"type":"application/pdf"}]
[merge-1234567890-abc123] Total size: 2.00MB
[merge-1234567890-abc123] Starting to convert 2 files to ArrayBuffers...
[merge-1234567890-abc123] File 1/2 (file1.pdf, 1.00MB) converted in 150ms
[merge-1234567890-abc123] All files converted to ArrayBuffers in 300ms
[merge-1234567890-abc123] Starting PDF merge...
[mergePDFs] Starting merge of 2 PDFs (2.00MB total)
[mergePDFs] Processing file 1/2 (1.00MB)...
[mergePDFs] File 1 loaded: 10 pages
[mergePDFs] File 1 processed in 200ms
[mergePDFs] Merge completed!
[merge-1234567890-abc123] PDF merge completed in 500ms
[merge-1234567890-abc123] Total request time: 1000ms
```

## If You Don't See Any Logs

### Possible Issues:

1. **Request Never Reaches Server**
   - Check browser Network tab
   - Look for `/api/merge` request
   - Check if it's pending or failed

2. **Request Times Out Before Logging**
   - AWS Amplify default timeout: 10 seconds
   - Check if request completes before timeout
   - Look for timeout errors in browser console

3. **Logs Are Filtered**
   - Clear all filters in "Hosting compute logs"
   - Check time range (last hour, last 24 hours)
   - Try different time ranges

4. **Wrong Environment**
   - Make sure you're looking at the correct branch/environment
   - Check if you're on production vs preview

## How to Test

1. **Make a merge request** from your deployed site
2. **Immediately go to** AWS Amplify Console → Monitoring → Hosting compute logs
3. **Refresh the logs** (or wait for auto-refresh)
4. **Look for** `[merge-` or `[Client]` prefixed logs
5. **Check the timestamp** matches when you made the request

## Alternative: Check CloudWatch Logs

If Hosting compute logs don't show anything:

1. Go to **AWS Console** → **CloudWatch**
2. **Log groups** → Look for `/aws/amplify/blendpdf`
3. Find log streams with recent timestamps
4. Search for "merge" or your request ID

## Debugging Steps

### Step 1: Verify Request is Sent
- Open browser DevTools → Network tab
- Filter by `/api/merge`
- Make a merge request
- Check if request appears and its status

### Step 2: Check Browser Console
- Open DevTools → Console tab
- Look for `[Client]` prefixed logs
- Check for error messages
- Note the request ID if shown

### Step 3: Check AWS Amplify Logs
- Go to Hosting compute logs (NOT Access logs)
- Filter by time range when you made the request
- Look for request ID from browser console
- Check for any error messages

### Step 4: Check Lambda/Function Logs
- The first image you showed has Lambda function logs
- These might be for other functions (not the merge API)
- Check the request IDs match your merge requests

## What the Logs Tell Us

### If You See Logs:
- ✅ Request reached the server
- ✅ We can see where it fails
- ✅ We can see timing information
- ✅ We can identify the issue

### If You Don't See Logs:
- ❌ Request might not be reaching server
- ❌ Request might be timing out immediately
- ❌ Logs might be in different location
- ❌ Need to check browser Network tab first

## Next Steps

1. **Try a merge request** right now
2. **Check browser Network tab** - does the request show up?
3. **Check browser Console** - any errors or logs?
4. **Go to Hosting compute logs** - refresh and look for new entries
5. **Share what you find** - this will help identify the issue

