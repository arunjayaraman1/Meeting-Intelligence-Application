import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
// Initialize Cloudflare bindings for local development
initOpenNextCloudflareForDev();
const nextConfig: NextConfig = {
  /* config options here */
};
export default nextConfig;