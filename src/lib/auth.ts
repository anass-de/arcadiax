import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),

  session: {
    strategy: "jwt",
  },

  pages: {
    signIn: "/login",
  },

  debug: false,

  providers: [
    CredentialsProvider({
      name: "Credentials",

      credentials: {
        identifier: {
          label: "Username or Email",
          type: "text",
        },
        password: {
          label: "Password",
          type: "password",
        },
      },

      async authorize(credentials) {
        const rawIdentifier = String(credentials?.identifier ?? "").trim();
        const password = String(credentials?.password ?? "");

        if (!rawIdentifier || !password) {
          return null;
        }

        const identifier = rawIdentifier.toLowerCase();

        const user = await prisma.user.findFirst({
          where: {
            OR: [{ email: identifier }, { username: identifier }],
          },
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            image: true,
            role: true,
            passwordHash: true,
          },
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);

        if (!valid) {
          return null;
        }

        return {
          id: user.id,
          name: user.name ?? user.username,
          email: user.email,
          image: user.image,
          role: user.role ?? "USER",
          username: user.username,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = (user as { id?: string }).id ?? token.sub;
        (token as { role?: string }).role =
          (user as { role?: string }).role ?? "USER";
        (token as { username?: string | null }).username =
          (user as { username?: string | null }).username ?? null;
      }

      if (token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email.toLowerCase() },
          select: {
            id: true,
            role: true,
            username: true,
            name: true,
            email: true,
            image: true,
          },
        });

        if (dbUser) {
          token.sub = dbUser.id;
          (token as { role?: string }).role = dbUser.role ?? "USER";
          (token as { username?: string | null }).username =
            dbUser.username ?? null;
          token.name = dbUser.name ?? dbUser.username;
          token.email = dbUser.email;
          (token as { picture?: string | null }).picture = dbUser.image ?? null;
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.sub ?? "";
        (session.user as { role?: string }).role =
          (token as { role?: string }).role ?? "USER";
        (session.user as { username?: string | null }).username =
          (token as { username?: string | null }).username ?? null;
        session.user.name = token.name ?? null;
        session.user.email = token.email ?? null;
        session.user.image =
          ((token as { picture?: string | null }).picture ?? null) as
            | string
            | null;
      }

      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};