import bcrypt from "bcryptjs";

/**
 * Compare a plain text password with a stored hash.
 * @param plainPassword - The password entered by the user
 * @param hashedPassword - The hash stored in the database
 * @returns True if the password matches
 */
export const comparePassword = async (
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> => {
  console.log("🔍 comparePassword called with:");
  console.log("   plainPassword length:", plainPassword.length);
  console.log("   hashedPassword:", hashedPassword);
  const result = await bcrypt.compare(plainPassword, hashedPassword);
  console.log("   bcrypt.compare result:", result);
  return result;
};

/**
 * Hash a password with a given salt round.
 * @param password - The plain password to hash
 * @param salt - Number of salt rounds (default 12)
 * @returns The hashed password
 */
export const hashPassword = async (password: string, salt: number = 12): Promise<string> => {
  return bcrypt.hash(password, salt);
};