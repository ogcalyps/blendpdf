# Option: Use Amplify Lambda Functions Instead

## What You Found

The page you're looking at shows how to add **explicit Lambda functions** to Amplify using the Amplify Gen 2 backend framework. This is a different approach from Next.js API routes.

## Current Situation

- ✅ **Health endpoint works** (`/api/health`) - Next.js API routes CAN work
- ❌ **Merge endpoint fails** - FormData requests not reaching server
- ❌ **No Lambda functions** in Lambda Console

## Two Possible Approaches

### Approach 1: Fix Next.js API Routes (Current)

**Pros:**
- Already have code written
- Health endpoint works (proves API routes work)
- Just need to fix FormData issue

**Cons:**
- FormData might be fundamentally broken on Amplify WEB_COMPUTE
- May need Base64 workaround (already implemented)

### Approach 2: Use Amplify Lambda Functions (What You Found)

**Pros:**
- More control over timeout (up to 15 minutes)
- Better for file uploads
- Explicit Lambda functions you can configure

**Cons:**
- Need to rewrite API routes as Lambda functions
- More complex setup
- Need to install `@aws-amplify/backend`

## Recommendation

Since the **health endpoint works**, Next.js API routes should work. The issue is specifically with **FormData/file uploads**.

**Try this first:**
1. Test the Base64 endpoint we just created (after deployment)
2. If Base64 works → Problem solved!
3. If Base64 doesn't work → Then consider Lambda functions

## If You Want to Try Lambda Functions

If Base64 doesn't work, we can set up Lambda functions:

1. **Install Amplify backend:**
   ```bash
   npm create amplify@latest
   ```

2. **Create function structure:**
   ```
   amplify/
     merge-function/
       resource.ts
       handler.ts
   ```

3. **Move merge logic to Lambda handler**

4. **Configure timeout to 30 seconds (or more)**

This is more work but gives more control.

## Next Step

**Wait for the Base64 deployment to complete**, then test it. If it works, we're done! If not, we can set up Lambda functions.

What would you like to do?

