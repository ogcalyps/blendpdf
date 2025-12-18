# Use IAM Role Instead of Access Keys (Recommended)

## The Problem

Environment variables set in Amplify Console are **NOT available in Lambda functions**. This is a known Amplify limitation.

## The Solution: Use IAM Role

Instead of access keys, use the **Lambda execution role** with S3 permissions. This is:
- ✅ More secure (no keys to manage)
- ✅ Works automatically (no env vars needed)
- ✅ Standard AWS best practice

## Step 1: Find Your Lambda Execution Role

1. Go to **AWS Lambda Console**
2. Find the function: `Compute-d4thw6hcta6re` (or similar)
3. Go to **Configuration** → **Permissions**
4. Click on the **Execution role** name
5. This opens IAM Console

## Step 2: Add S3 Permissions to the Role

1. In **IAM Console**, you should see the role
2. Click **Add permissions** → **Create inline policy**
3. Click **JSON** tab
4. Paste this policy (replace `blendpdf-uploads` with your bucket name):

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

5. Click **Next** → Name it `S3UploadAccess` → **Create policy**

## Step 3: Update Code to Use IAM Role

I've already updated the code to:
- Use IAM role by default (no credentials needed)
- Fall back to access keys if provided (for local dev)

## Step 4: Only Set Bucket Name

You only need to set the bucket name. But since env vars don't work, we need another approach:

### Option A: Hardcode Bucket Name (Quick Fix)

Temporarily hardcode the bucket name in code:

```typescript
const BUCKET_NAME = 'blendpdf-uploads';
```

### Option B: Use Amplify Secrets

1. **Amplify Console** → **App settings** → **Secrets**
2. Add secret: `_AWS_S3_BUCKET_NAME=blendpdf-uploads`
3. These should be available at runtime

### Option C: Use Environment Variable in Build

Set bucket name during build (but this is static):

```yaml
# amplify.yml
preBuild:
  commands:
    - export AWS_S3_BUCKET_NAME=blendpdf-uploads
```

## Recommended: Hardcode for Now

Since env vars don't work, let's hardcode the bucket name temporarily. You can change it later.

## Next Steps

1. **Add S3 permissions to IAM role** (Step 2 above)
2. **Hardcode bucket name** in code (quick fix)
3. **Test merge** - should work!

Let me know if you want me to hardcode the bucket name!

