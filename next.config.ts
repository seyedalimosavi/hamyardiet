import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permit the sandbox preview hostname to load development assets and HMR.
  allowedDevOrigins: ["*.e2b.app"],
};

export default nextConfig;
