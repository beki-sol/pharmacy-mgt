import NextAuth from 'next-auth';




enum Role {
  ADMIN,
  PHARMACIST,
  SALES_ASSISTANT,
  MANAGER,
  INVENTORY_MANAGER,
}

declare module 'next-auth' {
    interface Session {
        user: {
            id: string,
            role: string,
            email: string,
            name: string,
            twoFactorEnabled: boolean
;
        }
    }

    interface User {
        role: string ,
        twoFactorEnabled: boolean;
        twoFactorSecret?: string;
    }
}