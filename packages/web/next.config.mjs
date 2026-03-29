/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    "**.daytonaproxy01.net",
  ],
  images: {
    unoptimized: true,
  },
  // Mark native addon packages as external so they're not bundled by webpack
  serverExternalPackages: [
    "ssh2",
    "cpu-features",
    "@upstream/agents",
  ],
  // Empty turbopack config to acknowledge we're using webpack
  turbopack: {},
  webpack: (config, { isServer }) => {
    // Exclude .node files from webpack bundling entirely
    config.module.noParse = /\.node$/

    // Mark packages with native addons as external on the server
    if (isServer) {
      const externals = config.externals || []
      config.externals = [
        ...externals,
        "cpu-features",
        "ssh2",
        "@upstream/agents",
      ]
    }

    return config
  },
}

export default nextConfig
