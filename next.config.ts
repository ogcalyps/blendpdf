import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // Enable standalone output for optimized deployment
  output: 'standalone',

  // Don't advertise the framework in response headers
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },

  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
  
  // Externalize pdfjs-dist to prevent bundling issues in API routes
  serverExternalPackages: ['pdfjs-dist', 'canvas'],
  
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Server-side: externalize canvas to avoid bundling native bindings
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        // Externalize canvas (native module)
        config.externals.push('canvas');
        // Exclude pdf.js worker from webpack bundling
        config.externals.push({
          'pdfjs-dist/build/pdf.worker.js': 'commonjs pdfjs-dist/build/pdf.worker.js',
        });
      }
      
      // Alias canvas to use the project's version
      config.resolve.alias = {
        ...config.resolve.alias,
        canvas: require.resolve('canvas'),
        // Force pdfjs-dist to use the root canvas instead of its nested version
        'pdfjs-dist/node_modules/canvas': require.resolve('canvas'),
      };
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
