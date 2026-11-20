import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  // خروجی standalone همیشه مسطح ساخته شود (مستقل از lockfile های مسیر والد)
  // تا دستور مستند DEPLOYMENT.md یعنی node .next/standalone/server.js همیشه معتبر بماند.
  outputFileTracingRoot: path.join(__dirname),
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
