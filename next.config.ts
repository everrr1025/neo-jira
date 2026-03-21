import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  transpilePackages: ["webmcp-react"],
  serverExternalPackages: ["@tailwindcss/oxide", "@tailwindcss/oxide-win32-x64-msvc"],
};

export default nextConfig;
