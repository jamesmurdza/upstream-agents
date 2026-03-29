/**
 * Returns whether dev mode is enabled (GITHUB_PAT is set).
 * Used by the login page to auto-redirect to dev session.
 */

import { isAuthSkipped } from "@/lib/auth/dev-auth"

export async function GET() {
  return Response.json({ enabled: isAuthSkipped() })
}
