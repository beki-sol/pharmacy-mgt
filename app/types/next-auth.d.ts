import "next-auth";
import { Role } from "@prisma/client";

declare module "next-auth" {
  interface User {
    id: string;
    email: string;
    name: string;
    role: string;
    twoFactorEnabled: boolean;
    branchId?: string | null;
    branches?: any[]; // you can import Branch type from Prisma if desired
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      twoFactorEnabled: boolean;
      branchId?: string | null;
      branches?: any[];
    };
  }
}