import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Treat Prisma and ioredis as external packages to prevent Turbopack bundling issues
  serverExternalPackages: ['@prisma/client', '@prisma/engines', 'ioredis'],
};

export default nextConfig;
