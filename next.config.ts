import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  // Phase 10: Optimize package imports for libraries that export many sub-modules.
  // This replaces barrel-file imports with direct deep imports, reducing initial JS bundle.
  experimental: {
    optimizePackageImports: [
      'recharts',
      'lucide-react',
      'framer-motion',
      'date-fns',
      '@radix-ui/react-icons',
    ],
  },
};

export default nextConfig;
