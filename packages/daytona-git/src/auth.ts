/**
 * Authentication utilities for git operations
 *
 * Credentials are passed via git -c flags and never persisted.
 */

// Declare globals for environments (Node.js Buffer, browser btoa)
declare const Buffer:
  | { from(str: string): { toString(encoding: string): string } }
  | undefined
declare const btoa: ((str: string) => string) | undefined

/**
 * Base64 encode a string (works in both Node.js and browsers)
 */
function base64Encode(str: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(str).toString("base64")
  }
  if (typeof btoa !== "undefined") {
    return btoa(str)
  }
  throw new Error("No base64 encoding available")
}

/**
 * Escape a shell argument to prevent injection
 */
function escapeShellArg(arg: string): string {
  return `'${arg.replace(/'/g, "'\\''")}'`
}

/**
 * Build git -c flags for authentication
 *
 * Uses http.extraHeader with Basic auth. The credential exists only
 * for the single command invocation - nothing touches disk.
 *
 * @param token - The authentication token (e.g., GitHub PAT)
 * @returns Git -c flag string to prepend to commands
 */
export function authFlags(token: string): string {
  const credentials = base64Encode(`x-access-token:${token}`)
  return `-c http.extraHeader=${escapeShellArg(`Authorization: Basic ${credentials}`)}`
}
