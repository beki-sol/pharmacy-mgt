import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { User } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "./prisma";
import { Adapter } from "next-auth/adapters";
import { comparePassword } from "@/util/password";
import { Verify2FA } from "@/util/twofactor";
import { headers } from "next/headers"

type AuthCredentials = {
  email?: string;
  password?: string;
  twoFactorCode?: string;
};

const SALT =12;

export  const { handlers, auth, signIn, signOut } = NextAuth ({
  adapter: PrismaAdapter(prisma) as Adapter,

  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60,
  },

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

      async authorize(
        credentials: Record<string, unknown> | undefined
      ): Promise<User | null> {
        try {
          const { email, password, twoFactorCode } =
            credentials as AuthCredentials;

          if (!email || !password) {
            throw new Error("Missing credentials");
          }

          const user = await prisma.user.findUnique({
            where: { email },
          });

          if (!user || !user.isActive) {
            throw new Error("User does not exist or is inactive");
          }

          const isPasswordValid = await comparePassword(
            password,
            user.password,
            SALT
          );

          if (!isPasswordValid) {
            throw new Error("Invalid credentials");
          }

          // 🔐 2FA
          if (user.twoFactorEnabled) {
            if (!twoFactorCode) {
              throw new Error("2FA code required");
            }

            if (!user.twoFactorSecret) {
              throw new Error("2FA secret missing");
            }

            const is2FAValid = Verify2FA(
              user.twoFactorSecret,
              twoFactorCode
            );

            if (!is2FAValid) {
              throw new Error("Invalid 2FA code");
            }
          }

          await prisma.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() },
          });

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            twoFactorEnabled: user.twoFactorEnabled
          };
        } catch (error) {
          console.error("AUTH ERROR:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({token,user, trigger,session}){
      if(user){
        token.id=user.id;
        token.name=user.name;
        token.role=user.role;
        token.email=user.email;
        token.twoFactorEnabled = user.twoFactorEnabled;

      }
      if(trigger==='update'){
        if(typeof session?.name==="string"){
          token.name=session.name
        }
      }

      return token;
    },
    async session({token,session}){
       if(session.user){
        session.user.id=token.id as string;
        session.user.email=token.email as string;
        session.user.name=token.name as string;
        session.user.role=token.role as string;
        session.user.twoFactorEnabled=token.twoFactorEnabled as boolean;

       }
       return session;
    },
    async redirect({url,baseUrl}){
      // allow relative Urls
      if(url.startsWith('/')) return `${baseUrl}${url}`

      if(new URL(url).origin===baseUrl) return url

      return baseUrl


    },

 
    
  },

  events: {

    async signIn({ user,isNewUser }) {
     if (!user.id) {
      // This should never happen in practice, but TS needs proof
      throw new Error("User ID is missing in signIn event")
    }
    const h = await headers()
    if (isNewUser){
      await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "REGISTERED",
        entity: "USER",
        entityId: user.id as string,
        ipAddress: h.get("x-forwarded-for") ?? "unknown",
        userAgent: h.get("user-agent") ?? "unknown",
        newData: new Date(),
         },
       })
   

    }
    
  },

  

  }

});
