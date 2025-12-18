# Request Hanging - Even Small Files

## The Problem

- Even very small files (< 500KB) hang
- Request never completes
- No server logs appear
- Health endpoint works fine

## What This Means

Since even small files hang, this is **NOT** a timeout issue. The request is likely:
1. **Not reaching the server** at all
2. **Blocked at Amplify level** before reaching Next.js
3. **FormData parsing issue** - hanging on file upload
4. **Request size limit** - even small files might exceed some limit

## Possible Causes

### Cause 1: FormData Upload Limit

Amplify might have a request size limit that's blocking file uploads:
- Even small PDFs might exceed the limit
- The request might be rejected before reaching Next.js
- No logs because it never reaches the handler

### Cause 2: Request Routing Issue

The POST request with FormData might not be routed correctly:
- GET requests work (health endpoint)
- POST with FormData might be blocked
- Need to check Amplify routing configuration

### Cause 3: CORS or Security Policy

Amplify might be blocking file uploads:
- Security policy blocking FormData
- CORS issue (though same-origin should be fine)
- Request validation failing silently

## Solutions to Try

### Solution 1: Check Request Size in Browser

1. Open **Developer Tools** → **Network** tab
2. Make a merge request
3. Click on the `/api/merge` request
4. Check **"Request"** tab → **"Payload"**
5. What's the **total size**?
6. Is it being sent? (Check if payload is visible)

### Solution 2: Try Different File Upload Method

Instead of FormData, try:
- Base64 encoding (for very small files)
- Chunked upload
- Direct file upload to S3, then process

### Solution 3: Check Amplify Request Limits

Amplify might have limits on:
- Request body size
- FormData size
- File upload size

Check Amplify documentation for limits.

### Solution 4: Add Request Validation Earlier

Add validation before FormData parsing:
- Check Content-Type header
- Check Content-Length
- Fail fast if invalid

## Immediate Test

### Test 1: Check Request Payload

1. **Network tab** → Click on `/api/merge` request
2. **Request** tab → **Payload**
3. **Is the payload visible?**
4. **What's the size?**

### Test 2: Try Health Endpoint with POST

1. Test: `POST /api/health` (without files)
2. Does it work?
3. This tests if POST requests work at all

### Test 3: Check Browser Console

1. **Console tab** in Developer Tools
2. **Any errors?**
3. **Any warnings about request size?**

## Next Steps

1. **Check Network tab** → Request payload size
2. **Check Console** → Any errors?
3. **Try POST to /api/health** → Does POST work at all?

Share what you find!

