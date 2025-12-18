# How to Verify Google Analytics Deployment

## 1. Check AWS Amplify Deployment

1. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify)
2. Select your app
3. Check the **Deployments** tab:
   - ✅ Latest deployment should show "Success"
   - ✅ Check build logs for any errors
   - ✅ Note the deployment time

## 2. Verify Environment Variables

1. In Amplify Console → **App settings** → **Environment variables**
2. Verify these are set:
   ```
   NEXT_PUBLIC_GA_ID=G-0Y9R0VV31X
   ```
3. If missing, add them and **redeploy**

## 3. Test in Browser (Deployed Site)

### Method 1: Network Tab
1. Open your deployed site: `https://your-app.amplifyapp.com`
2. Open **DevTools** (F12) → **Network** tab
3. Filter by: `gtag` or `collect`
4. **You should see:**
   - ✅ `googletagmanager.com/gtag/js?id=G-0Y9R0VV31X`
   - ✅ `google-analytics.com/collect?...tid=G-0Y9R0VV31X...`

### Method 2: Console Check
1. Open **DevTools** → **Console** tab
2. Run:
   ```javascript
   window.gtag
   ```
3. **Should return:** `function gtag() { ... }` (not `undefined`)

### Method 3: Check Page Source
1. Right-click → **View Page Source**
2. Search for: `G-0Y9R0VV31X`
3. **Should find:** The GA script with your ID

## 4. Verify in Google Analytics

1. Go to [Google Analytics](https://analytics.google.com)
2. Select your property
3. Go to **Reports** → **Realtime**
4. Visit your deployed site
5. **You should see:**
   - ✅ Your visit appear within 10-30 seconds
   - ✅ Page views incrementing
   - ✅ Active users showing

## 5. Common Issues

### ❌ No requests in Network tab
- **Check:** Environment variable is set in Amplify
- **Fix:** Add `NEXT_PUBLIC_GA_ID` and redeploy

### ❌ `window.gtag` is undefined
- **Check:** Script is loading (Network tab)
- **Fix:** Wait for page to fully load, check for JavaScript errors

### ❌ No data in Google Analytics
- **Check:** Correct GA ID is set
- **Check:** GA property is active
- **Wait:** Data can take 24-48 hours for some reports (Realtime should work immediately)

## Quick Test Checklist

- [ ] AWS Amplify deployment shows "Success"
- [ ] Environment variable `NEXT_PUBLIC_GA_ID` is set in Amplify
- [ ] Network tab shows `gtag/js` request
- [ ] Console shows `window.gtag` is defined
- [ ] Google Analytics Realtime shows your visit
- [ ] Page source contains your GA ID

