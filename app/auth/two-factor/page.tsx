import { auth } from "@/app/lib/auth";
import {z} from "zod";
import { NextRequest,NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { generate2FA,Verify2FA } from "@/util/twofactor";
import { comparePassword } from "@/util/password";
import { headers } from "next/headers";

const enable2FASchema = z.object({
  password: z.string().min(1, "Password is required"),
});

const verify2FASchema = z.object({
  code: z.string().length(6, "Code must be 6 digits"),
});


export async function GET(req: NextRequest){
 try {
       const session=await auth();
   
       if(!session?.user?.email){
           return NextResponse.json({
               message: "not Authorized!"
           },{status: 401});
       }
       
       const user=await prisma.user.findUnique({
           where: {email: session.user.email},
           select: {twoFactorEnabled: true},
           
       });
   
        return NextResponse.json({
           twoFactorEnabled: user?.twoFactorEnabled || false
        })
   
 } catch (error: any) {

    return NextResponse.json({
        error: error.message || "Failed to get 2FA status"
    }, {status: 500});
 }

}


export async function POST(req: NextRequest) {
   try {
     const session= await auth();
 
     if(!session?.user?.email){
         return NextResponse.json(
         { error: "Unauthorized" },
         { status: 401 }
       );
     }
      
     const body = await req.json();
     const user = await prisma.user.findUnique({
       where: { email: session.user.email },
     });
 
      if (!user) {
       return NextResponse.json(
         { error: "User not found" },
         { status: 404 }
       );
     }
 
    /* if the request is to generate or setup 2FA code
     1.check if the password is correct 
     2. generate 2FA
     3. store 2FA code in the user table
     */
    if (body.action=="setup"){
 
     const {password }= enable2FASchema.parse(body)
 
     const isValidPassword= await comparePassword(password,user.password,10);
     
     if(!isValidPassword){
       return NextResponse.json(
           { error: "Invalid password" },
           { status: 400 }
         );  
     }
     // generate 2FA
 
     const {secret, qrCode,otpauthUrl}=await generate2FA(user.email);
     // store 2FA secrete/ code/token
     await prisma.user.update({
         where: {email: user.email},
         data: {twoFactorSecret: secret}
     });
 
     return NextResponse.json({
         message: "2FA secrete generated successfully",
        //secret: secret,
        qrCode: qrCode,
        otpauthUrl 
     },{status: 200})
 
 
    } else if(body.action==="verify"){
 
     const {code}=verify2FASchema.parse(body);
     
     if(!user?.twoFactorSecret){
       return NextResponse.json(
           { error: "2FA not configured" },
           { status: 400 }
         );
     }
 
     const isValid= Verify2FA(code,user.twoFactorSecret);
 
     if(!isValid){
        return NextResponse.json(
           { error: "Invalid verification code" },
           { status: 400 }
         );
     }
 
     await prisma.user.update({
       where: {id: user.id},
       data: {twoFactorEnabled: true}
     })
 
      // Create audit log
      const h= await headers();
       await prisma.auditLog.create({
         data: {
           userId: user.id,
           action: "ENABLE_2FA",
           entity: "User",
           entityId: user.id,
           ipAddress: h.get("x-forwarded-for") ?? "unknown",
           userAgent: h.get("user-agent") ?? "unknown",
            newData: new Date(),
         },
       });
 
     return NextResponse.json({
       message: "2FA enabled successfully",
     });
 
    } else if(body.action==="disable"){
     const {password,code }= body;
 
     const isValidPassword= await comparePassword(password,user.password,10);
 
     if(!isValidPassword){
       return NextResponse.json({
         error: "invalid password",
       }, {status: 401});
     }
 
     if (user.twoFactorEnabled && user.twoFactorSecret) {
       const isValid = await Verify2FA(code,user.twoFactorSecret);
       if (!isValid) {
         return NextResponse.json(
           { error: "Invalid 2FA code" },
           { status: 400 }
         );
       }
 
     }
 
 
     await prisma.user.update({
       where: {id: user.id},
       data: { 
         twoFactorEnabled: false,
         twoFactorSecret: null,
       }
     });
 
     const h= await headers();
       await prisma.auditLog.create({
         data: {
           userId: user.id,
           action: "DISABLE_2FA",
           entity: "User",
           entityId: user.id,
           ipAddress: h.get("x-forwarded-for") ?? "unknown",
           userAgent: h.get("user-agent") ?? "unknown",
            newData: new Date(),
         },
       });
 
     return NextResponse.json({
         message: "2FA disabled successfully",
       });
     
 
    }
   } catch (error: any) {

    console.error(error, "2FA error!")

    if(error instanceof z.ZodError){
      return NextResponse.json(
        {error: error.issues[0].message},
        {status:401}
      )
    }

   
    
   }
    



    
}