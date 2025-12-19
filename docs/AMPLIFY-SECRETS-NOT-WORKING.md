# Amplify Secrets Not Available in Lambda

## The Problem

Amplify Secrets set in the Console are **NOT automatically available as environment variables** in Lambda functions. This is a known limitation.

## What We've Tried

1. ✅ Checked for `_AWS_*` prefix (matches Secret management UI)
2. ✅ Checked for `AMPLIFY_SECRET_*` prefix
3. ✅ Checked for `AMAZON_*` prefix
4. ✅ Added extensive logging

**Result**: No AWS-related environment variables found at runtime.

## The Solution: Use IAM Role (Recommended)

Instead of access keys, use the **Lambda execution role** with S3 permissions. This is:
- ✅ More secure (no keys to manage)
- ✅ Works automatically
- ✅ Standard AWS best practice
- ✅ No environment variables needed

### Step 1: Find Your Lambda Function

1. Go to **AWS Lambda Console**: https://console.aws.amazon.com/lambda/
2. Make sure you're in **eu-north-1** region
3. Search for: `Compute-` or your app name

### Step 2: Add S3 Permissions to Execution Role

1. Click on the Lambda function
2. **Configuration** → **Permissions**
3. Click on the **Execution role** name (opens IAM)
4. **Add permissions** → **Create inline policy**
5. **JSON** tab → Paste this:

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

6. Name: `S3UploadAccess` → **Create policy**

### Step 3: Test

After adding permissions:
1. Wait 10-30 seconds for propagation
2. Try merging again
3. Should work! 🎉

## Why This Works

The AWS SDK automatically uses the Lambda execution role when no explicit credentials are provided. Once the role has S3 permissions, everything works without access keys.

## Alternative: Use AWS Secrets Manager

If you really need to use Secrets, you'd need to:
1. Store secrets in AWS Secrets Manager (not Amplify Secrets)
2. Give Lambda permission to read from Secrets Manager
3. Use AWS SDK to fetch secrets at runtime

But **IAM role is simpler and better**.

