import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      githubLogin?: string
    } & DefaultSession["user"]
    accessToken?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sub: string
  }
}
