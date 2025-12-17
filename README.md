# BlendPDF

Free online PDF tools. Merge, compress, split, and convert PDFs. Works in any language. No sign-up required.

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

## Deploy on Vercel

The easiest way to deploy BlendPDF is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme).

Check out the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
