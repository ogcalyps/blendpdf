# Where to Find Logs When No Lambda Functions Exist

## The Situation
- No Lambda log groups found
- API routes timing out
- Need to find where logs actually are

## Where Logs Actually Are

### Location 1: Amplify Hosting Compute Logs (✅ Found!)

1. Go to **AWS Amplify Console** → Your app (blendpdf)
2. **Left sidebar** → **Monitoring** → **Hosting compute logs**
3. You should see a table with:
   - **Branch name:** main
   - **CloudWatch log streams:** A clickable link like `log-group:/aws/amplify/d4thw6hcta6re:logStreamNameFilter:main`
4. **Click on that log stream link** to open the actual logs
5. **Make a merge request** from your site
6. **Refresh the log stream** or wait a few seconds
7. Look for: `MERGE_ROUTE_LOADED` or `========== MERGE API ROUTE CALLED ==========`

### Location 2: The CloudWatch Log Group You Found

You found: `/aws/amplify/d4thw6hcta6re`

1. **Click on the most recent log stream** (top one)
2. **Make a merge request** from your site
3. **Refresh the log stream** or wait a few seconds
4. **Look for any new entries** containing:
   - `merge`
   - `api/merge`
   - `MERGE_ROUTE_LOADED`
   - Any errors

### Location 3: Check All Log Streams

1. In `/aws/amplify/d4thw6hcta6re`, look at **all 38 log streams**
2. Click on recent ones (today's date: 2025-12-18)
3. Look for any that might contain API route logs
4. The stream names like `main/2025/12/18/...` are build/deployment logs
5. API route logs might be in a different stream format

## What This Means

If there are **no separate Lambda functions**, it means:
- Next.js API routes are part of the main Next.js server
- They're handled by Amplify's hosting compute
- Timeout is likely at the Amplify hosting level (10 seconds default)
- Logs should be in "Hosting compute logs" in Amplify Console

## Next Steps

### Step 1: Check Amplify Hosting Compute Logs
1. Go to Amplify Console → Monitoring → **Hosting compute logs**
2. Make a merge request
3. Check if logs appear there

### Step 2: Check the Log Stream You Found
1. Click the top log stream in `/aws/amplify/d4thw6hcta6re`
2. Make a merge request
3. See if any new logs appear

### Step 3: Test Health Endpoint
1. Visit: `https://your-domain.amplifyapp.com/api/health`
2. Does it return JSON?
3. If YES → API routes work, just timeout issue
4. If NO → API routes aren't deployed

### Step 4: Check Amplify Build Settings
1. Amplify Console → App settings → Build settings
2. Look for **"Function timeout"** or **"Compute timeout"**
3. Increase to 30 seconds if you find it

## Why No Lambda Functions?

Next.js on Amplify can work in two ways:

1. **Separate Lambda functions** (what we expected)
   - Each API route = separate Lambda
   - Easy to configure timeout per route
   - Logs in `/aws/lambda/...`

2. **Single serverless function** (what you have)
   - All API routes in one function
   - Timeout configured at Amplify level
   - Logs in Amplify hosting compute logs

You have option 2, which is actually simpler to fix!

## How to Fix Timeout (Option 2)

Since there's no separate Lambda:

1. **Amplify Console** → **App settings** → **Build settings**
2. Look for **"Function timeout"** or **"Compute timeout"**
3. Change to **30 seconds**
4. **OR** check **"Environment variables"** for timeout settings

If you can't find timeout settings in Amplify Console, you might need to:
- Contact AWS Support
- Or use a different deployment approach

