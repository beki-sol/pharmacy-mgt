
import bcrypt from "bcryptjs";
import { sign, verify } from "jsonwebtoken";
import "dotenv/config";
import {prisma} from "@/app/lib/prisma";
import { sendEmail, sendPasswordResetEmail} from "@/app/service/email/service";
import { sendTelegramMessage } from "@/app/service/telegram/service";
export const generatePassworResetToken= async (email: string)=>{
    const user=await prisma.user.findUnique({
        where: { email}
    })
    if(!user){
        throw new Error('no user exist!!!')
    }

    const token=sign({email: user.email, userId:user.id, expiresIn: "1h" },process.env["NODE_ENV"]);

    const expires= new Date (Date.now()+3600000);
     
     await prisma.user.update({
        where: {
            email: user.email,
        },
        data:{
            passwordResetToken: token,
            passwordResetExpires: expires,
        }
     })
     // end email 
    if (user.telegramChatId) {
            const resetUrl = `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${token}`;
            const message = `
            <b>Password Reset Request</b>

            You requested to reset your password. Click the link below to proceed:

            ${resetUrl}

            This link will expire in 1 hour.

            If you didn't request this, please ignore this message.
            `;
            await sendTelegramMessage({
            chatId: user.telegramChatId,
            text: message,
            });
        } else {
            // Fallback to email or log
            console.log(`User ${user.email} has no Telegram chat ID. Password reset link:`);
        }
   


     return token


}


export const verfiyPasswordResetToken= async (token: string)=>{
    try {
        const decoded= verify(token, process.env.NODE_ENV)  as {
                userId: string;
                email: string;
               };
        const user= await prisma.user.findUnique({
            where: {
                id: decoded.userId,
                passwordResetToken: token,
                passwordResetExpires: {gt: new Date()}
            }
        })
        if(!user){
            throw new Error("user does not exist or token expires !")
        }

       return user;
        
    } catch (error) {
        throw new Error("Invalid or expired token");
        
    }
    


}

export const resetPassword= async (token: string, newPassword: string)=>{
    const user=await verfiyPasswordResetToken(token);

    const hashedPassword= await bcrypt.hash(newPassword, 12);
     if (!user){
        throw new Error('user does not exist')
     }
    // STORE TO THE DATABASE

    await prisma.user.update({
        where: {id: user.id,},
        data: {password: hashedPassword,
             passwordResetToken: null,
              passwordResetExpires: null}

    })
    // create audit log
    await prisma.auditLog.create({
        data: {
            userId: user.id,
            action: "Password_Reset",
            entity: "User",
            entityId: user.id


        }
    })
     
    // send succesfull password rest email
   
     await sendEmail({
    to: user.email,
    subject: "Password Reset Successful",
    html: `
      <h1>Password Reset Successful</h1>
      <p>Your password has been successfully reset.</p>
      <p>If you didn't perform this action, please contact support immediately.</p>
    `,
  });

  return true;
}


