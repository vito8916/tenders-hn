import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
    // staleTimes: {
    //   dynamic: 30, // Re-fetch dynamic routes after 30 seconds
    //   static: 180, // Re-fetch statically generated pages or prefetched links after 180 seconds
    // },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        port: '',
        pathname: '/storage/v1/object/**',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '54321',
        pathname: '/storage/v1/object/**',
      },
    ],
    qualities: [90, 85, 75, 50, 25],
    dangerouslyAllowLocalIP: true,
  },
};

export default nextConfig;
