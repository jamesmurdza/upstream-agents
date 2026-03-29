/**
 * Dev-only endpoint that creates a session for the dev user.
 * This allows the UI to work in dev mode without real OAuth.
 *
 * Only works when GITHUB_PAT is set and NODE_ENV !== "production"
 */

import { cookies } from "next/headers"
import { encode } from "next-auth/jwt"
import { isAuthSkipped, ensureDevUserExists, DEV_USER_ID, DEV_USER } from "@/lib/auth/dev-auth"

export async function GET() {
  // Only allow in dev mode
  if (!isAuthSkipped()) {
    return Response.json({ error: "Not available" }, { status: 404 })
  }

  try {
    // Ensure dev user exists in database
    await ensureDevUserExists()

    // Create a JWT token for the dev user
    const token = await encode({
      token: {
        sub: DEV_USER_ID,
        name: DEV_USER.name,
        email: DEV_USER.email,
        picture: null,
      },
      secret: process.env.NEXTAUTH_SECRET!,
      maxAge: 30 * 24 * 60 * 60, // 30 days
    })

    // Set the session cookie
    const cookieStore = await cookies()

    // Set both cookie variants to ensure compatibility
    // The __Secure- prefix is required when accessed via HTTPS (Daytona proxy)
    // The non-prefixed version is for localhost HTTP access

    // For HTTPS access (Daytona proxy)
    cookieStore.set("__Secure-next-auth.session-token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60, // 30 days
    })

    // For HTTP access (localhost)
    cookieStore.set("next-auth.session-token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60, // 30 days
    })

    // Redirect to home
    return Response.redirect(new URL("/", process.env.NEXTAUTH_URL || "http://localhost:3000"))
  } catch (error) {
    console.error("Dev session error:", error)
    return Response.json({ error: "Failed to create dev session" }, { status: 500 })
  }
}
