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
          label: "Username oder E-Mail",
          type: "text",
        },
        password: {
          label: "Passwort",
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
          name: user.name ?? user.username ?? undefined,
          email: user.email,
          image: user.image,
          role: user.role ?? "USER",
          username: user.username ?? undefined,
        } as any;
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = (user as any).id ?? token.sub;
        (token as any).role = (user as any).role ?? "USER";
        (token as any).username = (user as any).username ?? null;
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
          (token as any).role = dbUser.role ?? "USER";
          (token as any).username = dbUser.username ?? null;
          token.name = dbUser.name ?? dbUser.username ?? token.name;
          token.email = dbUser.email ?? token.email;
          (token as any).picture =
            dbUser.image ?? (token as any).picture ?? null;
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub ?? "";
        (session.user as any).role = (token as any).role ?? "USER";
        (session.user as any).username = (token as any).username ?? null;
        session.user.name = token.name ?? session.user.name;
        session.user.email = token.email ?? session.user.email;
        session.user.image =
          ((token as any).picture as string | null) ?? session.user.image;
      }

      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};