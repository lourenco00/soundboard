/** @type {import('next').NextConfig} */
const nextConfig = {
  // ESLint stays off during builds (CI runs `next build --no-lint`).
  eslint: { ignoreDuringBuilds: true },
  // Type errors now fail the build — the codebase is type-clean (tsc --noEmit
  // passes), so this catches regressions instead of shipping them.
  typescript: { ignoreBuildErrors: false },
};

module.exports = nextConfig;
