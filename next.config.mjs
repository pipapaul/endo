// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',         // ← aktiviert Static Export beim Build
  trailingSlash: true,      // saubere /route/ → /route/index.html
  images: { unoptimized: true }, // <Image> ohne Optimizer
};
export default nextConfig;
