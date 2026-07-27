/** @type {import('next').NextConfig} */
const nextConfig = {
  // The LibSQL adapter pulls in the native `libsql`/`@libsql/*` packages, which
  // use dynamic requires and ship non-JS files (LICENSE/README) that webpack
  // tries to parse. Marking them external for server components keeps them as
  // runtime `require()`s (Node loads the native binding directly) instead of
  // bundling them. (Next 14 key; renamed to `serverExternalPackages` in 15.)
  experimental: {
    serverComponentsExternalPackages: [
      "@prisma/adapter-libsql",
      "@libsql/client",
      "libsql",
    ],
  },
};

export default nextConfig;
