import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  transpilePackages: ["webmcp-react"],
  serverExternalPackages: ["@tailwindcss/oxide", "@tailwindcss/oxide-win32-x64-msvc"],
  experimental: {
    serverActions: { bodySizeLimit: "3mb" },
    // Include multipart overhead; the upload route enforces the actual file limit.
    proxyClientMaxBodySize: `${Number(process.env.KNOWLEDGE_MAX_FILE_MIB || 50) + 2}mb`,
  },
};

export default nextConfig;
