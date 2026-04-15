import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Transpile workspace packages (source imports)
  transpilePackages: ["background-agents", "@upstream/common"],
}

export default nextConfig
