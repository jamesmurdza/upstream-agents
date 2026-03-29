/**
 * Development authentication bypass
 *
 * When SKIP_AUTH=true is set, this module provides a mock user for local development.
 * The dev user is auto-created in the database on first use.
 *
 * WARNING: Never enable SKIP_AUTH in production!
 */

import { prisma } from "@/lib/prisma"

// Fixed dev user ID - consistent across restarts
export const DEV_USER_ID = "dev-user-00000000-0000-0000-0000-000000000000"

export const DEV_USER = {
  id: DEV_USER_ID,
  email: "dev@localhost",
  name: "Dev User",
  githubId: "000000",
  githubLogin: "dev-user",
}

/**
 * Check if auth should be skipped (development only)
 */
export function isAuthSkipped(): boolean {
  // Never skip auth in production
  if (process.env.NODE_ENV === "production") {
    return false
  }
  return process.env.SKIP_AUTH === "true"
}

/**
 * Ensures the dev user exists in the database.
 * Creates the user and related records if they don't exist.
 * This is called lazily on first auth check when SKIP_AUTH=true.
 */
export async function ensureDevUserExists(): Promise<void> {
  const existingUser = await prisma.user.findUnique({
    where: { id: DEV_USER_ID },
  })

  if (existingUser) {
    return
  }

  console.warn("\n" + "=".repeat(60))
  console.warn("SKIP_AUTH: Creating dev user in database...")
  console.warn("=".repeat(60) + "\n")

  // Create the dev user
  await prisma.user.create({
    data: {
      id: DEV_USER_ID,
      email: DEV_USER.email,
      name: DEV_USER.name,
      githubId: DEV_USER.githubId,
      githubLogin: DEV_USER.githubLogin,
      isAdmin: true, // Dev user is admin by default
      maxSandboxes: 100,
    },
  })

  // Create default credentials record
  await prisma.userCredentials.create({
    data: {
      userId: DEV_USER_ID,
      anthropicAuthType: "api-key",
      sandboxAutoStopInterval: 5,
      defaultLoopMaxIterations: 10,
      loopUntilFinishedEnabled: false,
    },
  })

  console.warn("\n" + "=".repeat(60))
  console.warn("SKIP_AUTH: Dev user created successfully!")
  console.warn("")
  console.warn("To use GitHub features, you need to add a GitHub token.")
  console.warn("You can do this via the Settings page in the UI, or by")
  console.warn("manually inserting an Account record in the database.")
  console.warn("=".repeat(60) + "\n")
}

/**
 * Log a warning that auth is being skipped (only once per process)
 */
let hasWarnedAboutSkipAuth = false
export function warnAboutSkippedAuth(): void {
  if (hasWarnedAboutSkipAuth) return
  hasWarnedAboutSkipAuth = true

  console.warn("\n" + "!".repeat(60))
  console.warn("WARNING: Authentication is being skipped (SKIP_AUTH=true)")
  console.warn("This should ONLY be used for local development!")
  console.warn("!".repeat(60) + "\n")
}
