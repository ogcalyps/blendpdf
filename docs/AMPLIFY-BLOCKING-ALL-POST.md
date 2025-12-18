# Critical: Amplify Blocking All Large POST Requests

## The Problem

Even Base64 (JSON) requests aren't reaching the server:
- ❌ No logs appear
- ❌ Times out after 30 seconds
- ❌ Request never reaches Next.js

This suggests **Amplify is blocking large POST request bodies entirely**.

## What This Means

Amplify WEB_COMPUTE might have:
- **Request body size limit** (maybe 1-2MB?)
- **Timeout before request reaches Next.js**
- **Blocking large POST bodies** at the proxy level

## Solutions

### Solution 1: Use Amplify Lambda Functions (Recommended)

Since Next.js API routes aren't working for file uploads, we need to use **explicit Lambda functions**:

1. **Install Amplify backend:**
   ```bash
   npm create amplify@latest
   ```

2. **Create Lambda function for merge:**
   - More control over timeout (up to 15 minutes)
   - Better for file uploads
   - Can configure memory and timeout

3. **Upload files to S3 first, then process:**
   - Client uploads to S3
   - Lambda processes from S3
   - Returns result

### Solution 2: Use Direct S3 Upload

1. **Client uploads files directly to S3** (presigned URLs)
2. **API route receives S3 keys** (not file data)
3. **Lambda processes files from S3**
4. **Returns result**

### Solution 3: Switch Hosting Provider

For file uploads, consider:
- **Vercel** - Better Next.js support, handles file uploads
- **Railway/Render** - More flexible
- **AWS Lambda directly** - Full control

## Immediate Test

I've added a test endpoint (`/api/merge-test`) that:
- Accepts a small JSON payload
- Logs immediately
- Tests if POST requests work at all

**Try this in browser console:**
```javascript
fetch('/api/merge-test', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ test: true })
})
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)
```

If this works → POST works, issue is body size
If this fails → POST is blocked entirely

## Next Steps

1. **Test the test endpoint** (see above)
2. **If test works** → We know it's body size limit
3. **If test fails** → POST is blocked, need Lambda functions
4. **Set up Lambda functions** if needed

What do you want to do?

