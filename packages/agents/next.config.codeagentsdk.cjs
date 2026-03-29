/**
 * Merge this into your Next.js config so the SDK's native deps (ssh2 / cpu-features)
 * are not bundled by Webpack.
 *
 * Usage (next.config.js or next.config.mjs):
 *   import codeagentsdk from 'agents/next.config'
 *   export default { ...codeagentsdk, ...yourConfig }
 *
 * Or (next.config.cjs):
 *   const codeagentsdk = require('agents/next.config')
 *   module.exports = { ...codeagentsdk, ...yourConfig }
 */
module.exports = {
  serverExternalPackages: ['ssh2', 'cpu-features'],
  webpack: (config) => {
    config.module.rules.push({
      test: /\.node$/,
      type: 'asset/resource',
    })
    return config
  },
}
