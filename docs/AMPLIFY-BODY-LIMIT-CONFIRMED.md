# Amplify Body Size Limit Confirmed

## The Problem

Even a **0.42MB JSON payload** isn't reaching the server:
- ❌ No logs in AWS
- ❌ Times out after 30 seconds
- ❌ Request blocked before reaching Next.js

## What This Means

**Amplify WEB_COMPUTE has a very strict request body size limit**, likely **< 400KB**.

This means:
- ✅ Very small files (< 200KB each) → Might work
- ❌ Files ≥ 200KB → Blocked by Amplify

## Current Status

- Test endpoint works (tiny payload) ✅
- Base64 with 0.42MB → Blocked ❌
- No logs appear → Request never reaches server ❌

## Solutions

### Option 1: Use S3 for File Uploads (Recommended)

1. **Client uploads files directly to S3** (presigned URLs)
2. **API route receives S3 keys** (not file data)
3. **Lambda processes files from S3**
4. **Returns result**

**Pros:**
- Works for any file size
- More reliable
- Standard approach for file uploads

**Cons:**
- Requires S3 setup
- More complex

### Option 2: Use Amplify Lambda Functions

Set up explicit Lambda functions:
- Better timeout control
- Can handle larger payloads
- More configuration options

**Pros:**
- More control
- Can configure timeout/memory

**Cons:**
- Requires rewriting API routes
- More setup

### Option 3: Switch Hosting Provider

For file uploads, consider:
- **Vercel** - Better Next.js support, handles file uploads
- **Railway/Render** - More flexible
- **AWS Lambda directly** - Full control

## Immediate Action

I've lowered the Base64 limit to 400KB. For now:
- Files < 200KB each → Will try Base64
- Files ≥ 200KB → Will show error suggesting S3/Lambda

## Next Steps

1. **Test with very small files** (< 200KB each) - might work
2. **If it still fails** → Need S3 or Lambda functions
3. **Set up S3 upload** → Best long-term solution

What would you like to do?

