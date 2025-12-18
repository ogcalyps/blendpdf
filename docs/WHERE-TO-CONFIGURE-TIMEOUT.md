# Where to Configure Timeout in AWS Amplify

## ❌ NOT in amplify.yml

The `amplify.yml` file is for **build configuration** only. Timeout settings are configured elsewhere.

## ✅ Where to Configure Timeout

### Option 1: Amplify Console - Build Settings (Most Likely)

1. Go to **AWS Amplify Console** → Your app (blendpdf)
2. **App settings** (left sidebar)
3. **Build settings** (or **General**)
4. Look for:
   - **"Function timeout"**
   - **"Compute timeout"**
   - **"Hosting compute timeout"**
   - **"Serverless function timeout"**
5. Change to **30 seconds** (maximum)
6. **Save**

### Option 2: Amplify Console - Environment Variables

1. **App settings** → **Environment variables**
2. Look for timeout-related variables
3. Add if missing: `AWS_LAMBDA_TIMEOUT=30`

### Option 3: AWS Lambda Console (If Functions Exist)

Since we enabled `output: 'standalone'`, Amplify might create Lambda functions:

1. Go to **AWS Lambda Console**
2. Search for functions containing: `amplify-blendpdf` or `blendpdf`
3. Click on a function (e.g., one for `/api/merge`)
4. **Configuration** → **General configuration**
5. Click **Edit** on **Timeout**
6. Set to **30 seconds**
7. **Save**

### Option 4: Check Amplify Hosting Settings

1. **App settings** → **Hosting**
2. Look for **"Compute"** or **"Serverless"** settings
3. Check for timeout configuration

## What to Look For

The timeout setting might be labeled as:
- "Function timeout"
- "Compute timeout"
- "Hosting compute timeout"
- "Serverless function timeout"
- "API route timeout"
- "Lambda timeout"

## If You Can't Find It

If you can't find timeout settings in Amplify Console:

1. **Check AWS Lambda Console** - Amplify might have created Lambda functions
2. **Contact AWS Support** - They can help locate the setting
3. **Check Amplify Documentation** - Settings might be in a different location

## Next Steps

1. **Check Amplify Console** → **App settings** → **Build settings**
2. **Look for timeout settings**
3. **Set to 30 seconds**
4. **Save and redeploy**

After increasing the timeout, the merge should work!

