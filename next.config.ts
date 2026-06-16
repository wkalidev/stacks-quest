import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  async rewrites() {
    return [
      { source: '/.well-known/agent-card.json', destination: '/api/agent-card' },
    ]
  },
}

export default nextConfig
