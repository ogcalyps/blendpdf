# BlendPDF

Free online PDF tools. Merge, compress, split, and convert PDFs. Works in any language. No sign-up required.

> **SEO-First Development**: This project prioritizes SEO optimization. See [.seo-guidelines.md](.seo-guidelines.md) for SEO standards that must be followed for all features and content.

## Features

- **Merge PDFs**: Combine multiple PDF files into one
- **Compress PDF**: Reduce file size with three compression levels (Low, Medium, High)
- **Split PDF**: Extract specific pages from a PDF
- **Multi-language Support**: Full RTL support for Arabic, Hebrew, Persian, Urdu, and more
- **No Sign-up**: Upload, process, and download without creating an account
- **Auto-delete**: Files are automatically deleted after 1 hour

## Tech Stack

- [Next.js](https://nextjs.org) - React framework
- [pdf-lib](https://pdf-lib.js.org) - PDF manipulation library
- [next-intl](https://next-intl-docs.vercel.app) - Internationalization
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [Zustand](https://zustand-demo.pmnd.rs) - State management

## Getting Started

First, install dependencies:

```bash
npm install
# or
yarn install
# or
pnpm install
```

Then, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Build for Production

```bash
npm run build
npm start
```

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```bash
# Google Tag Manager ID (required for analytics)
# Get this from https://tagmanager.google.com
# Format: GTM-XXXXXXX
NEXT_PUBLIC_GTM_ID=GTM-XXXXXXX

# Google Analytics ID (optional - can also be configured via GTM)
# Get this from https://analytics.google.com
# Format: G-XXXXXXXXXX or UA-XXXXXXXXX-X
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

**Note:** Both GTM and GA are optional. If you don't provide IDs, the components won't render.

## Deploy on Vercel

The easiest way to deploy BlendPDF is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme).

Check out the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Deploy on AWS Amplify

The project is configured for AWS Amplify deployment. Make sure to set the environment variables in your Amplify console:

1. Go to your Amplify app settings
2. Navigate to Environment variables
3. Add `NEXT_PUBLIC_GTM_ID` and `NEXT_PUBLIC_GA_ID` if needed

### Verify Deployment

To verify Google Analytics is working:

1. **Check AWS Amplify Console:**
   - Go to Deployments tab → Latest deployment should show "Success"
   - Check App settings → Environment variables → Verify `NEXT_PUBLIC_GA_ID` is set

2. **Test in Browser:**
   - Open your deployed site
   - Open DevTools (F12) → Network tab
   - Filter by "gtag" → Should see requests to `googletagmanager.com/gtag/js?id=G-0Y9R0VV31X`
   - In Console, run `window.gtag` → Should return a function (not undefined)

3. **Check Google Analytics:**
   - Go to Google Analytics → Reports → Realtime
   - Visit your deployed site → Your visit should appear within 10-30 seconds

See `scripts/verify-analytics.md` for detailed verification steps.
