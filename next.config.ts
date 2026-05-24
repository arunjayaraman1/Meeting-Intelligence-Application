import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
const nextConfig: NextConfig = {
  allowedDevOrigins: ['university-try-strategic-rose.trycloudflare.com'],
};
export default nextConfig;