import speakeasy from "speakeasy";
import QRCode from "qrcode"

// generate token 

export const generate2FA= async (email: string)=>{

    const secret= speakeasy.generate2FA({
        name: `pharmacy-inventory ${email}`,
        length: 20
    })

    const qrCode= await QRCode.toDataURL(secret.otpath_url!)
    
    return {
        secret: secret.base32,
        qrCode,
        otpauthUrl: secret.otpauth_url
    }
}

// verify token 

export const Verify2FA= (token: string, twofactorsecret: string): boolean=>{
    const verify= speakeasy.totp.verify({
        secret: twofactorsecret,
        encoding: "base32",
        token,
        window: 1

    });

    return verify
}

