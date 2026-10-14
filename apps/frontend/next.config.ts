import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { resolve } from 'node:path';

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: resolve(__dirname, '../..'),
  async rewrites() {
    const backendUrl =
      process.env.BACKEND_URL ??
      (process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : null);

    return backendUrl
      ? [{ source: '/api/:path*', destination: `${backendUrl}/api/:path*` }]
      : [];
  },
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
