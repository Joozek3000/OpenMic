import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import withPWAInit from "@ducanh2912/next-pwa";

const __dirname = dirname(fileURLToPath(import.meta.url));

const withPWA = withPWAInit({
  dest: "public",
  // Keep PWA off by default until caching strategy is fully stabilized.
  // Enable explicitly with NEXT_PUBLIC_ENABLE_PWA=true.
  disable: process.env.NEXT_PUBLIC_ENABLE_PWA !== "true",
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      // Avoid stale/partial Mapbox tiles from SW cache (prevents checkerboard squares).
      urlPattern: /^https:\/\/(api|events)\.mapbox\.com\/.*/,
      handler: "NetworkOnly",
    },
    {
      urlPattern: ({ request }) =>
        ["style", "script", "worker", "font"].includes(request.destination),
      handler: "CacheFirst",
      options: {
        cacheName: "static-resources",
        expiration: {
          maxAgeSeconds: 30 * 24 * 60 * 60,
          maxEntries: 100,
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
    {
      urlPattern: ({ request }) => request.destination === "image",
      handler: "CacheFirst",
      options: {
        cacheName: "image-assets",
        expiration: {
          maxAgeSeconds: 30 * 24 * 60 * 60,
          maxEntries: 200,
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
    {
      urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/,
      handler: "CacheFirst",
      options: {
        cacheName: "video-content",
        expiration: {
          maxAgeSeconds: 7 * 24 * 60 * 60,
          maxEntries: 50,
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
    {
      urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/,
      handler: "NetworkFirst",
      options: {
        cacheName: "firestore-data",
        networkTimeoutSeconds: 10,
        expiration: {
          maxAgeSeconds: 5 * 60,
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
    {
      urlPattern: /^https:\/\/(identitytoolkit|securetoken)\.googleapis\.com\/.*/,
      handler: "NetworkOnly",
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: true,
  turbopack: {
    root: resolve(__dirname, "."),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
        pathname: "/**",
      },
    ],
  },
};

export default withPWA(nextConfig);
