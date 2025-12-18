# Quick Fix: S3 Setup (Environment Variables Don't Work)

## The Problem

Amplify environment variables set in Console are **NOT available in Lambda functions**. This is a known Amplify limitation.

## The Solution

I've updated the code to:
1. ✅ **Use IAM role** (no access keys needed)
2. ✅ **Hardcode bucket name** as fallback (`blendpdf-uploads`)

## What You Need to Do

### Step 1: Add S3 Permissions to Lambda Execution Role

1. Go to **AWS Lambda Console**
2. Find function: `Compute-d4thw6hcta6re` (or search for your app)
3. **Configuration** → **Permissions**
4. Click on the **Execution role** name (opens IAM)
5. **Add permissions** → **Create inline policy**
6. **JSON** tab → Paste this (replace bucket name if different):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::blendpdf-uploads/uploads/*"
    }
  ]
}
```

7. **Next** → Name: `S3UploadAccess` → **Create policy**

### Step 2: Verify Bucket Name

The code is hardcoded to use `blendpdf-uploads`. If your bucket has a different name, I can update it.

### Step 3: Test

After adding permissions and redeploying:
1. Upload 2 PDF files
2. Click "Merge"
3. Should work! 🎉

## Why This Works

- **IAM role**: Lambda uses its execution role automatically (no env vars needed)
- **Hardcoded bucket**: Bypasses the env var issue
- **More secure**: No access keys to manage

## After It Works

Once it's working, we can:
- Move bucket name to a config file
- Or find a way to use Amplify Secrets
- Or use a different approach

But for now, this should work!

