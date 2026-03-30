import path from "node:path"
import { fileURLToPath } from "node:url"
import { config as loadEnv } from "dotenv"
import { defineConfig } from "prisma/config"

const configDir = path.dirname(fileURLToPath(import.meta.url))
loadEnv({ path: path.join(configDir, "..", "..", ".env") })
loadEnv({ path: path.join(configDir, ".env"), override: true })

// Add connect_timeout to handle Neon serverless cold starts
function addConnectionTimeout(url: string): string {
  if (!url) return url
  const separator = url.includes("?") ? "&" : "?"
  return `${url}${separator}connect_timeout=30`
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: addConnectionTimeout(
      process.env.DATABASE_URL_UNPOOLED ||
        process.env.DATABASE_URL ||
        process.env.POSTGRES_URL ||
        ""
    ),
  },
})
