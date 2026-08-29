import bcrypt from "bcryptjs";

/**
 * bcrypt maliyeti. bcryptjs saf JS olduğu için native'e göre yavaştır;
 * 12 ≈ 400ms/giriş — finansal bir uygulama için kabul edilebilir bir bedel.
 */
export const BCRYPT_COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
