/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Transpile the workspace packages so Next can compile their TypeScript
  // sources directly inside the App Router build.
  transpilePackages: ['@bot/shared', '@bot/database'],
  // Forward env from the host.  We read everything from process.env at
  // request time so changes to docker compose env don't require a rebuild.
  experimental: {
    // Enable typed routes in a future iteration.
  },
  // The Discord OAuth callback uses the system fetch; we don't need
  // any specific image configuration.
  poweredByHeader: false,
  // Make sure server components run with the right env in the container.
  serverExternalPackages: ['@prisma/client', 'prisma'],
  reactStrictMode: true,
};

export default nextConfig;
