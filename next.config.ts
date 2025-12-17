import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // Enable standalone output for AWS Amplify
  output: 'standalone',
  
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
  
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Server-side: allow canvas and configure pdf.js worker
      config.resolve.alias = {
        ...config.resolve.alias,
        canvas: require.resolve('canvas'),
      };
      // Exclude pdf.js worker from webpack bundling (we'll load it directly)
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push({
          'pdfjs-dist/build/pdf.worker.js': 'commonjs pdfjs-dist/build/pdf.worker.js',
        });
      }
    } else {
      // Client-side: disable canvas
      config.resolve.alias = {
        ...config.resolve.alias,
        canvas: false,
      };
    }
    return config;
  },
};

export default withNextIntl(nextConfig);
