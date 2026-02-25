
import {prisma} from "@/app/lib/prisma"
import bcrypt from "bcryptjs";
import { JWT } from "next-auth/jwt";
import { Adapter } from "next-auth/adapters";
import { comparePassword,hashPassword } from "@/util/password";
import { generate2FA,Verify2FA } from "@/util/twofactor";
import { User } from "next-auth";

/*  
1.checke if the credential has password and email
2. fetch password and email from the user database
3.check if user is exist and compare the password
4. check if 2fa is enabled 
5. if enabled and there is no twofactor code generate 2f code else verfit the 2f code
6. return the users 


*/

interface credentials{
    email: string,
    password: string,
    twoFactorCode: string 
}
const SALT=10

export const authorize= async (credentials:credentials )=>{

    if (!credentials.email || !credentials.password){
        return null
    }

    const user= await prisma.user.findUnique({
        where: {email: credentials.email}
    })

    if (!user || !user.isActive){
        return new Error ("user is not active or user does not exist")
    }
    const verfiyPassword =await comparePassword(credentials.password,user.password,SALT)

    if (!verfiyPassword){
        throw new Error ("Invalid credentialss");
    }

    if (credentials.twoFactorCode){
        if(!user.twoFactorSecret){
            return {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                twoFactorEnabled: true,
                twoFactorSecret: user.twoFactorSecret || undefined,
              };
        }

        // if 2f code is exist verify
        const verfy2fcode= Verify2FA(user.twoFactorSecret ,credentials.password)

        if(!verfy2fcode){
            throw new Error ('opt credential is not correct')
        }



     

    }
      
        await prisma.user.update({
            where: {id: user.id},
            data: {lastLogin: new Date()}
        })

       return {
            id: user.id,
            email: user.email,
            name: user.name,
            phone: user.phone,
            role: user.role,
            twofactorEnabled: user.twoFactorEnabled
        }




}



