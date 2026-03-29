import CryptoJS from "crypto-js"

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY

if (!ENCRYPTION_KEY && process.env.NODE_ENV === "production") {
  console.warn("WARNING: ENCRYPTION_KEY not set. Credentials will not be encrypted properly.")
}

export function encrypt(text: string): string {
  if (!ENCRYPTION_KEY) {
    // In development without key, return as-is (not secure, but allows testing)
    return text
  }
  return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString()
}

export function decrypt(ciphertext: string): string {
  if (!ENCRYPTION_KEY) {
    // In development without key, return as-is
    return ciphertext
  }
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY)
    const decrypted = bytes.toString(CryptoJS.enc.Utf8)
    // If decryption fails (wrong key or not encrypted), return original
    return decrypted || ciphertext
  } catch {
    return ciphertext
  }
}
