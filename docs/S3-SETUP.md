# S3 Setup Instructions

## What We've Implemented

We've set up S3 file uploads to bypass Amplify's strict body size limit. The flow is:

1. **Client requests presigned URLs** from `/api/upload-url`
2. **Client uploads files directly to S3** using presigned URLs
3. **Client sends S3 keys** to `/api/merge-s3`
4. **Server downloads from S3**, merges, returns result
5. **Server cleans up S3 files** after processing

## Required Environment Variables

You need to set these in **Amplify Console** → **App settings** → **Environment variables**:

**Note:** Amplify doesn't allow `AWS_` prefix, so use `_AWS_` prefix instead:

```
_AWS_REGION=eu-north-1
_AWS_ACCESS_KEY_ID=your-access-key-id
_AWS_SECRET_ACCESS_KEY=your-secret-access-key
_AWS_S3_BUCKET_NAME=your-bucket-name
```

## Step 1: Create S3 Bucket

1. Go to **AWS S3 Console**
2. **Create bucket**
3. **Bucket name**: e.g., `blendpdf-uploads`
4. **Region**: `eu-north-1` (same as Amplify)
5. **Block Public Access**: Keep enabled (presigned URLs handle access)
6. **Create bucket**

## Step 2: Create IAM User for S3 Access

1. Go to **AWS IAM Console**
2. **Users** → **Create user**
3. **User name**: `blendpdf-s3-user`
4. **Attach policies directly** → **Create policy**
5. Use this policy (replace `your-bucket-name`):

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
      "Resource": "arn:aws:s3:::your-bucket-name/uploads/*"
    }
  ]
}
```

6. **Create user** → **Create access key** → **Save credentials**

## Step 3: Add Environment Variables to Amplify

1. **Amplify Console** → Your app → **App settings** → **Environment variables**
2. Add (use `_AWS_` prefix because Amplify doesn't allow `AWS_`):
   - `_AWS_REGION=eu-north-1`
   - `_AWS_ACCESS_KEY_ID=<from IAM user>`
   - `_AWS_SECRET_ACCESS_KEY=<from IAM user>`
   - `_AWS_S3_BUCKET_NAME=<your-bucket-name>`
3. **Save** and **redeploy**

## Step 4: Test

After deployment:
1. Upload 2 PDF files
2. Click "Merge"
3. Should work! Files upload to S3, then merge

## How It Works

- **Presigned URLs**: Allow direct upload to S3 without exposing credentials
- **Automatic cleanup**: Files are deleted after processing
- **No size limits**: S3 handles any file size
- **Reliable**: Standard approach for file uploads

## Troubleshooting

If upload fails:
1. Check environment variables are set correctly
2. Check IAM user has correct permissions
3. Check S3 bucket exists and is in correct region
4. Check Amplify logs for errors

