import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["firebase-admin", "pg"],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
