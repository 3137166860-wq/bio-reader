import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Ensure pdfjs-dist worker can be served correctly
  serverExternalPackages: ['pdfjs-dist'],

  // Configure headers for AI SDK streaming
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
        ],
      },
    ]
  },
}

export default nextConfig
