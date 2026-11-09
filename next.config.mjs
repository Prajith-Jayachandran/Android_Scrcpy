/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Prevents double WebSocket connections in dev mode
  productionBrowserSourceMaps: false, // Ensures zero client-side source map leakage
  swcMinify: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error'] } : false,
  },
  poweredByHeader: false, // Hides X-Powered-By: Next.js header
};

export default nextConfig;
