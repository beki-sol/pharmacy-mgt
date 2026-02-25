import bcrypt from "bcryptjs";



export const comparePassword = async (
  password: string,      
  hashedPassword: string, 
  salt: number
) => {
  const secretPassword = await hashPassword(password,salt)
  const isValidPassword = await bcrypt.compare(hashedPassword, secretPassword);

  return isValidPassword;
};


export const hashPassword= async (password: string, salt: number )=>{
    
    const hasedPassword= await bcrypt.hash(password,salt)

    return hasedPassword;
}






