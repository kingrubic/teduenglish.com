export const MIN_NEW_PASSWORD = 10;
export const TEMP_PASSWORD_LENGTH = 12;

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export function generateTempPassword(length = TEMP_PASSWORD_LENGTH) {
  const size = Math.max(length, MIN_NEW_PASSWORD);
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

export function passwordMeetsPolicy(password: string) {
  return password.length >= MIN_NEW_PASSWORD && password.length <= 100;
}

export function isReusableTempPassword(newPassword: string, tempPassword: string) {
  return newPassword === tempPassword;
}
