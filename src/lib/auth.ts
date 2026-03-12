import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";

/*
  Username aus Email generieren
*/
function buildUsernameFromEmail(email: string) {
  const localPart = email.split("@")[0] || "user";

  return (
    localPart
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 20) || "user"
  );
}

/*
  garantiert eindeutigen Username
*/
async function getUniqueUsername(base: string) {
  const safeBase = base.slice(0, 20) || "user";

  const existing = await prisma.user.findUnique({
    where: { username: safeBase },
    select: { id: true },
  });

  if (!existing) {
    return safeBase;
  }

  for (let i = 1; i <= 9999; i++) {
    const candidate = `${safeBase}-${i}`.slice(0, 20);

    const found = await prisma.user.findUnique({
      where: { username: candidate },
      select: { id: true },
    });

    if (!found) {
      return candidate;
    }
  }

  return `${safeBase}-${Date.now()}`.slice(0, 20);
}

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
    /*
      Google OAuth
    */
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),

    /*
      Username / Email Login
    */
    CredentialsProvider({
      name: "Credentials",

      credentials: {
        identifier: {
          label: "Username oder Email",
          type: "text",
        },
        password: {
          label: "Password",
          type: "password",
        },
      },

      async authorize(credentials) {
        const identifier = String(credentials?.identifier ?? "")
          .trim()
          .toLowerCase();

        const password = String(credentials?.password ?? "");

        if (!identifier || !password) {
          return null;
        }

        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: identifier },
              { username: identifier },
            ],
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
        } as any;
      },
    }),
  ],

  callbacks: {

    /*
      Google Login Handling
    */
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {

        const email = user.email.trim().toLowerCase();
        const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();

        const dbUser = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            role: true,
            username: true,
          },
        });

        if (dbUser) {
          const desiredRole =
            adminEmail && email === adminEmail ? "ADMIN" : dbUser.role ?? "USER";

          const updateData: {
            role?: "ADMIN" | "USER";
            username?: string;
          } = {};

          /*
            Admin automatisch setzen
          */
          if (dbUser.role !== desiredRole) {
            updateData.role = desiredRole;
          }

          /*
            Username automatisch generieren
          */
          if (!dbUser.username) {
            const base = buildUsernameFromEmail(email);
            updateData.username = await getUniqueUsername(base);
          }

          if (Object.keys(updateData).length > 0) {
            await prisma.user.update({
              where: { id: dbUser.id },
              data: updateData,
            });
          }

          (user as any).id = dbUser.id;
          (user as any).role = desiredRole;
        }
      }

      return true;
    },

    /*
      JWT erzeugen
    */
    async jwt({ token, user }) {

      if (user) {
        token.sub = (user as any).id ?? token.sub;
        (token as any).role =
          (user as any).role ?? (token as any).role ?? "USER";
      }

      /*
        Rolle nachladen falls JWT neu ist
      */
      if (!(token as any).role && token.email) {

        const dbUser = await prisma.user.findUnique({
          where: { email: token.email.toLowerCase() },
          select: {
            id: true,
            role: true,
          },
        });

        if (dbUser) {
          token.sub = dbUser.id;
          (token as any).role = dbUser.role ?? "USER";
        }
      }

      return token;
    },

    /*
      Session erzeugen
    */
    async session({ session, token }) {

      if (session.user) {
        (session.user as any).id = token.sub ?? "";
        (session.user as any).role = (token as any).role ?? "USER";
      }

      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};