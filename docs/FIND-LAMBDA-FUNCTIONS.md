# Finding Lambda Functions for API Routes

## Why We Need to Check Lambda

Since you're using `WEB_COMPUTE` with Next.js SSR and we enabled `output: 'standalone'`, Amplify creates Lambda functions for API routes. The timeout is configured at the Lambda function level, not in Amplify Console.

## Step-by-Step: Find Your Lambda Functions

### Step 1: Go to AWS Lambda Console

1. Go to [AWS Lambda Console](https://console.aws.amazon.com/lambda/)
2. Make sure you're in the **same region** as your Amplify app (looks like `eu-north-1` based on your ARN)

### Step 2: Search for Your Functions

1. In the Lambda Console, use the **search bar** at the top
2. Search for: `amplify-blendpdf` or `d4thw6hcta6re` or just `blendpdf`
3. Look for functions with names like:
   - `amplify-blendpdf-{hash}-api-merge-{hash}`
   - `amplify-blendpdf-{hash}-api-compress-{hash}`
   - `amplify-blendpdf-{hash}-api-split-{hash}`
   - Or similar patterns

### Step 3: Check Function Timeout

1. **Click on a function** (start with the merge one if you find it)
2. Go to **Configuration** tab (top menu)
3. Click **General configuration** (left sidebar)
4. Find **Timeout** - it probably says **10 seconds**
5. Click **Edit**
6. **Change to 30 seconds** (maximum)
7. Click **Save**
8. **Repeat for all API route functions**

## Alternative: Check All Functions

If you can't find functions by searching:

1. In Lambda Console, go to **Functions** (left sidebar)
2. Look through the list for any functions containing:
   - `amplify`
   - `blendpdf`
   - `d4thw6hcta6re`
   - `api-merge`
   - `api-compress`
   - `api-split`

## If No Lambda Functions Found

If you don't find any Lambda functions, it means:
- API routes might be handled differently
- We might need to configure timeout via environment variables
- Or use a different approach

## Next Steps

1. **Go to AWS Lambda Console**
2. **Search for functions** with your app name
3. **Check timeout** on any functions you find
4. **Share what you find** - do you see any Lambda functions?
