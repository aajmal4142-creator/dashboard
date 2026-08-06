import { withPayload } from "@payloadcms/next/withPayload";
import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/app", destination: "/", permanent: true },
      { source: "/app/:path*", destination: "/:path*", permanent: true },
    ];
  },
  // Content-Security-Policy for /r/html/:token and /public/reports/embed/:token is set
  // dynamically per-token in proxy.ts (frame-ancestors from the token's allowlist) — see
  // docs/embed-csp.md. No static wide-open frame-ancestors here.
  images: {
    localPatterns: [
      {
        pathname: "/api/media/file/**",
      },
      {
        pathname: "/brand/**",
      },
    ],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      ".cjs": [".cts", ".cjs"],
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
    };

    return webpackConfig;
  },
  turbopack: {
    root: path.resolve(dirname),
  },
};

export default withPayload(nextConfig, { devBundleServerPackages: false });
