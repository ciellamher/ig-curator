import { NextAuthOptions } from "next-auth"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import GoogleProvider from "next-auth/providers/google"
import EmailProvider from "next-auth/providers/email"
import InstagramProvider from "next-auth/providers/instagram"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "./prisma"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    EmailProvider({
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM,
    }),
    InstagramProvider({
      clientId: process.env.INSTAGRAM_CLIENT_ID || "",
      clientSecret: process.env.INSTAGRAM_CLIENT_SECRET || "",
    }),
    CredentialsProvider({
      id: "credentials",
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }
        
        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        })
        
        if (!user || !user.password) {
          return null
        }
        
        const bcrypt = require("bcryptjs")
        const isPasswordValid = await bcrypt.compare(credentials.password, user.password)
        
        if (!isPasswordValid) {
          return null
        }
        
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image
        }
      }
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    session: async ({ session, token }) => {
      if (session?.user && token.sub) {
        // @ts-ignore
        session.user.id = token.sub
      }
      if (token.instagramAccessToken) {
        // @ts-ignore
        session.instagramAccessToken = token.instagramAccessToken
      }
      return session
    },
    jwt: async ({ user, token, account }) => {
      if (user) {
        token.uid = user.id
      }
      if (account && account.provider === "instagram") {
        token.instagramAccessToken = account.access_token
      }
      if (account && account.provider === "demo") {
        token.instagramAccessToken = "demo_token_123"
      }
      return token
    },
  },
}
