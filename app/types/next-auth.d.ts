import NextAuth, { DefaultSession } from "next-auth";
import { Role } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      twoFactorEnabled: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
    twoFactorEnabled: boolean;
    twoFactorSecret?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    twoFactorEnabled: boolean;
  }
}