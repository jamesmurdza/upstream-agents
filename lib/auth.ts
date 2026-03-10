import { PrismaAdapter } from "@auth/prisma-adapter"
import { NextAuthOptions } from "next-auth"
import GitHubProvider from "next-auth/providers/github"
import { prisma } from "@/lib/prisma"

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

        // Fetch GitHub access token from Account table
        const account = await prisma.account.findFirst({
          where: { userId: token.sub, provider: "github" },
        })
        if (account?.access_token) {
          session.accessToken = account.access_token
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
        await prisma.user.update({
          where: { id: token.sub },
          data: {
            githubId: String(githubProfile.id),
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
