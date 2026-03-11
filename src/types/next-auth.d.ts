import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role?: string;
      username?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role?: string;
    username?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    username?: string | null;
  }
}