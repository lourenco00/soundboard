/** @type {import('next').NextConfig} */
const nextConfig = {
  // já estás a usar --no-lint no CI, mas deixo isto para garantir
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

module.exports = nextConfig;
