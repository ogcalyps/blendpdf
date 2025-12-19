# Fix: CredentialsProviderError - Could not load credentials

## The Error

```
Error [CredentialsProviderError]: Could not load credentials from any providers
```

## What This Means

The S3 client can't find credentials. This happens because:
- ✅ Bucket name is working (using hardcoded fallback)
- ❌ No credentials available (IAM role doesn't have S3 permissions)

## Solution: Add S3 Permissions to Lambda Execution Role

The Lambda function needs S3 permissions in its execution role.

### Step 1: Find Your Lambda Function

1. Go to **AWS Lambda Console**: https://console.aws.amazon.com/lambda/
2. Make sure you're in the **same region** as your Amplify app (looks like `eu-north-1`)
3. Search for: `Compute-d4thw6hcta6re` or `Compute-` or your app name

### Step 2: Open the Execution Role

1. Click on the Lambda function
2. Go to **Configuration** tab (top menu)
3. Click **Permissions** (left sidebar)
4. Click on the **Execution role** name (it's a link, opens in IAM Console)

### Step 3: Add S3 Permissions

1. In **IAM Console**, you should see the role
2. Click **Add permissions** → **Create inline policy**
3. Click **JSON** tab
4. Paste this policy (replace `blendpdf-uploads` with your bucket name if different):

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

5. Click **Next**
6. Name: `S3UploadAccess`
7. Click **Create policy**

### Step 4: Test Again

After adding the policy:
1. Wait 10-30 seconds for permissions to propagate
2. Try merging again
3. Should work! 🎉

## Alternative: Use Access Keys (Not Recommended)

If you can't modify the IAM role, you can add access keys as Secrets:

1. **Amplify Console** → **App settings** → **Secrets**
2. Add:
   - `AWS_ACCESS_KEY_ID` = Your access key
   - `AWS_SECRET_ACCESS_KEY` = Your secret key

But **IAM role is better** - more secure and no keys to manage.

## Verify It Worked

After adding permissions, check the logs. You should see:
- ✅ No credentials error
- ✅ Successful S3 upload
- ✅ Merge completes

