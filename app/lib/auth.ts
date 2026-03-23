import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";
import { comparePassword } from "@/util/password";
import { Verify2FA } from "@/util/twofactor";
import { headers } from "next/headers";
import { Adapter } from "next-auth/adapters";

type AuthCredentials = {
  email?: string;
  password?: string;
  twoFactorCode?: string;
};

const SALT = 12;

// NextAuth returns a request handler function (in your environment)
const authHandler = NextAuth({
  adapter: PrismaAdapter(prisma) as Adapter,
  session: { strategy: "jwt", maxAge: 24 * 60 * 60 },
  pages: {
    signIn: "/auth/login",
    signOut: "/auth/logout",
    error: "/auth/error",
    verifyRequest: "/auth/verify",
    newUser: "/auth/register",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        twoFactorCode: { label: "2FA Code", type: "text", required: false },
      },
      async authorize(credentials): Promise<any> {
        try {
          const { email, password, twoFactorCode } = credentials as AuthCredentials;
          if (!email || !password) throw new Error("Missing credentials");

          const user = await prisma.user.findUnique({
            where: { email },
            include: {
              branches: {
                include: { branch: true },
              },
            },
          });
           console.log("👤 User found:", user ? "yes" : "no");

          if (!user || !user.isActive) throw new Error("User does not exist or is inactive");
          console.log("🔑 Stored hash length:", user.password.length);
          console.log("Stored hash (first 20 chars):", user.password.substring(0, 20) + "...");

          const isValid = await comparePassword(password, user.password);
          if (!isValid) throw new Error("Invalid credentials");

          if (user.twoFactorEnabled) {
            if (!twoFactorCode) throw new Error("2FA code required");
            if (!user.twoFactorSecret) throw new Error("2FA secret missing");
            const is2FAValid = Verify2FA(user.twoFactorSecret, twoFactorCode);
            if (!is2FAValid) throw new Error("Invalid 2FA code");
          }

          await prisma.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() },
          });

          const defaultBranch = user.branches.find(ub => ub.isDefault)?.branch;
          const branchId = defaultBranch?.id || user.branches[0]?.branch?.id || null;

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            twoFactorEnabled: user.twoFactorEnabled,
            branchId,
            branches: user.branches.map(ub => ub.branch),
          };
        } catch (error) {
          console.error("AUTH ERROR:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.role = user.role;
        token.email = user.email;
        token.twoFactorEnabled = user.twoFactorEnabled;
        token.branchId = user.branchId;
        token.branches = user.branches;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.role = token.role as string;
        session.user.twoFactorEnabled = token.twoFactorEnabled as boolean;
        session.user.branchId = token.branchId as string | null;
        session.user.branches = token.branches as any[];
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
  events: {
    async signIn({ user, isNewUser }) {
      if (!user.id) throw new Error("User ID missing in signIn event");
      const h = await headers();
      if (isNewUser) {
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            action: "REGISTERED",
            entity: "USER",
            entityId: user.id,
            ipAddress: h.get("x-forwarded-for") ?? "unknown",
            userAgent: h.get("user-agent") ?? "unknown",
            newData: new Date(),
          },
        });
      }
    },
  },
});

// In your environment, NextAuth returns a function (request handler)
// We export it as `handlers` for the route file.
export const handlers = authHandler;

// For convenience, also export auth, signIn, signOut if they exist.
// In your case, authHandler might not have these properties, but we'll try.
export const auth = (authHandler as any).auth;
export const signIn = (authHandler as any).signIn;
export const signOut = (authHandler as any).signOut;