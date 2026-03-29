import { PrismaAdapter } from "@auth/prisma-adapter"
import { NextAuthOptions } from "next-auth"
import GitHubProvider from "next-auth/providers/github"
import { prisma } from "@/lib/db/prisma"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "repo read:user",
        },
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub

        // Fetch GitHub access token and login from database
        const [accounts, user] = await Promise.all([
          prisma.account.findMany({
            where: { userId: token.sub, provider: "github" },
            select: { access_token: true, providerAccountId: true, id: true },
            orderBy: { id: "asc" },
          }),
          prisma.user.findUnique({
            where: { id: token.sub },
            select: { githubLogin: true, githubId: true },
          }),
        ])
        const preferred = user?.githubId
          ? accounts.find((account) => account.providerAccountId === user.githubId)
          : undefined
        const fallback = accounts[accounts.length - 1]
        const accessToken = preferred?.access_token ?? fallback?.access_token
        if (accessToken) {
          session.accessToken = accessToken
        }
        if (user?.githubLogin) {
          session.user.githubLogin = user.githubLogin
        }
      }
      return session
    },
    async jwt({ token, user, account, profile }) {
      if (user) {
        token.sub = user.id
      }

      // On sign in, store GitHub-specific info
      if (account?.provider === "github" && profile) {
        const githubProfile = profile as { id: number; login: string }
        const providerAccountId = String(githubProfile.id)

        // Ensure the newest OAuth tokens are persisted after re-consent.
        // Without this, a previously revoked token can keep being used.
        await prisma.account.updateMany({
          where: {
            userId: token.sub,
            provider: "github",
            providerAccountId,
          },
          data: {
            access_token: account.access_token ?? null,
            refresh_token: account.refresh_token ?? null,
            expires_at: account.expires_at ?? null,
            token_type: account.token_type ?? null,
            scope: account.scope ?? null,
            id_token: account.id_token ?? null,
          },
        }).catch(() => {
          // Account row may not exist yet during first sign-in creation.
        })

        await prisma.user.update({
          where: { id: token.sub },
          data: {
            githubId: providerAccountId,
            githubLogin: githubProfile.login,
          },
        }).catch(() => {
          // User might not exist yet during initial creation
        })
      }

      return token
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
}
