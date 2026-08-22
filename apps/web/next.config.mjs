/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@social-growth-os/ai",
    "@social-growth-os/analytics",
    "@social-growth-os/content-engine",
    "@social-growth-os/database",
    "@social-growth-os/platform-connectors",
    "@social-growth-os/shared",
    "@social-growth-os/worker",
  ],
  webpack(config) {
    // apps/worker uses NodeNext resolution (explicit ".js" specifiers for
    // its own .ts sources); teach webpack to resolve those the same way.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
