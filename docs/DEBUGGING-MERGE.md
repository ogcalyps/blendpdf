# Debugging PDF Merge Issues in Production

## Problem
Merge operations in production take forever and do nothing.

## Potential Causes

### 1. AWS Amplify Serverless Function Timeout ⚠️
**Default timeout: 10 seconds** (can be increased to 30 seconds max)

**Solution:**
- The code now includes `maxDuration = 30` in the API route
- Check AWS Amplify console → App settings → Build settings
- Ensure function timeout is set to maximum (30 seconds)

### 2. File Size Limits
- **Per file limit:** 50MB
- **Total limit:** 100MB for all files combined
- **File count limit:** 20 files max

**Check logs for:**
```
Validation failed: Total size too large
Validation failed: File size exceeds maximum
```

### 3. Memory Issues
Large PDFs can consume significant memory during processing.

**Symptoms:**
- Function times out
- No error message
- Request hangs

**Solution:**
- Process files sequentially instead of all at once (future optimization)
- Reduce file sizes before merging
- Split large merges into smaller batches

## Debugging Steps

### 1. Check Server Logs

In AWS Amplify Console:
1. Go to **App** → **Monitoring** → **Logs**
2. Filter by `/api/merge`
3. Look for request IDs like `merge-1234567890-abc123`

**What to look for:**
```
[merge-xxx] Merge request started
[merge-xxx] Received X files
[merge-xxx] File info: [...]
[merge-xxx] Total size: X.XXMB
[merge-xxx] Starting PDF merge...
[merge-xxx] Processing file 1/X...
[merge-xxx] Merge completed!
```

### 2. Check Client Console

Open browser DevTools → Console:
- Look for `[Client]` prefixed logs
- Check for timeout errors
- Note request IDs for correlation

### 3. Check Network Tab

1. Open DevTools → Network
2. Filter by `/api/merge`
3. Check:
   - **Status:** Should be 200 (success) or error code
   - **Time:** How long the request took
   - **Size:** Request and response sizes
   - **Preview:** Error message if failed

### 4. Common Error Patterns

#### Timeout Error
```
Request timed out. The files may be too large.
```
**Solution:** Reduce file sizes or number of files

#### Size Limit Error
```
Total file size exceeds maximum allowed size of 100MB
```
**Solution:** Compress files first or merge in batches

#### Memory Error
```
Failed to merge PDFs: [memory-related error]
```
**Solution:** Process files one at a time (future optimization)

## Enhanced Logging

The merge function now logs:
- ✅ Request start/end times
- ✅ File count and sizes
- ✅ Processing time per file
- ✅ Total processing time
- ✅ Memory usage indicators
- ✅ Request IDs for correlation

## AWS Amplify Configuration

### Increase Function Timeout

1. Go to AWS Amplify Console
2. Select your app
3. Go to **App settings** → **Build settings**
4. Edit `amplify.yml` or use console settings
5. Set function timeout to **30 seconds** (maximum)

### Monitor Function Performance

1. Go to **Monitoring** → **Metrics**
2. Check:
   - Function duration
   - Error rate
   - Memory usage
   - Invocation count

## Testing Locally

To test merge functionality locally:

```bash
npm run dev
```

Then check:
- Browser console for `[Client]` logs
- Terminal/server logs for `[merge-xxx]` logs
- Network tab for request details

## Performance Optimization (Future)

1. **Streaming:** Process files in chunks
2. **Queue System:** Use background jobs for large merges
3. **Caching:** Cache intermediate results
4. **Parallel Processing:** Process multiple files simultaneously (with memory limits)

## Quick Fixes

### If merge hangs:
1. Check file sizes (should be < 50MB each)
2. Check total size (should be < 100MB)
3. Check number of files (should be < 20)
4. Check AWS Amplify logs for timeout errors
5. Try with smaller files first

### If merge fails silently:
1. Check browser console for errors
2. Check network tab for failed requests
3. Check AWS Amplify logs
4. Look for request IDs in error messages

## Request ID Correlation

Every merge request now has a unique ID:
- Format: `merge-{timestamp}-{random}`
- Appears in both client and server logs
- Use this to correlate client and server logs

Example:
```
[Client] Merge error: Connection failed (Request ID: merge-1234567890-abc123)
[merge-1234567890-abc123] Error merging PDFs: Timeout
```

