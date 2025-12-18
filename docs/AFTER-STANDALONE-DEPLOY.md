# After Enabling Standalone Output - What to Do Next

## What We Just Did

1. ✅ Enabled `output: 'standalone'` in `next.config.ts`
2. ✅ Committed and pushed to trigger Amplify redeploy

## What Happens Next

After Amplify redeploys (takes 5-10 minutes), it should:
- Create **Lambda functions** for each API route
- Deploy `/api/merge`, `/api/compress`, `/api/split` as separate Lambda functions
- These functions will appear in **AWS Lambda Console**

## Step 1: Wait for Deployment

1. Go to **Amplify Console** → Your app
2. **Deployments** → Watch the latest deployment
3. Wait for it to complete (usually 5-10 minutes)

## Step 2: Check Lambda Functions Again

After deployment completes:

1. Go to **AWS Lambda Console**
2. Make sure you're in **eu-north-1** (Europe Stockholm)
3. **Search for:** `amplify-blendpdf` or `d4thw6hcta6re`
4. You should now see Lambda functions like:
   - `amplify-blendpdf-{hash}-api-merge-{hash}`
   - `amplify-blendpdf-{hash}-api-compress-{hash}`
   - `amplify-blendpdf-{hash}-api-split-{hash}`

## Step 3: Increase Timeout on Lambda Functions

For each Lambda function you find:

1. **Click on the function name**
2. **Configuration** → **General configuration**
3. Find **Timeout** (probably says **10 seconds**)
4. Click **Edit**
5. Change to **30 seconds** (maximum)
6. Click **Save**
7. **Repeat for all API route functions**

## Step 4: Test Again

After increasing timeouts:

1. Go to your BlendPDF site
2. Upload 2 small PDFs
3. Click "Merge"
4. Should work now! 🎉

## If Still No Lambda Functions

If after redeploy you still don't see Lambda functions:

1. **Check Amplify Console** → **Deployments** → **Build logs**
2. Look for errors or warnings about API routes
3. Check if `output: 'standalone'` is being recognized
4. We might need to try a different approach

## Alternative: Environment Variable

If Lambda functions still don't appear, try adding an environment variable:

1. **Amplify Console** → **App settings** → **Environment variables**
2. Click **Manage variables**
3. Add: `AWS_LAMBDA_TIMEOUT=30`
4. **Save** and **redeploy**

## Next Steps

1. **Wait for deployment to complete** (5-10 minutes)
2. **Check Lambda Console again** for new functions
3. **Increase timeout** on any functions you find
4. **Test merge** again

Let me know what you find after the deployment completes!

