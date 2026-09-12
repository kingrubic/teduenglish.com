import { describe, expect, it } from "vitest";
import {
  generateTempPassword,
  isReusableTempPassword,
  MIN_NEW_PASSWORD,
  passwordMeetsPolicy,
  TEMP_PASSWORD_LENGTH,
} from "./password";

describe("password policy", () => {
  it("generates a temp password long enough to log in and then change", () => {
    const password = generateTempPassword();
    expect(password).toHaveLength(TEMP_PASSWORD_LENGTH);
    expect(passwordMeetsPolicy(password)).toBe(true);
    expect(password).toMatch(/^[A-Za-z0-9]+$/);
  });

  it("rejects passwords shorter than 10 characters", () => {
    expect(passwordMeetsPolicy("123456789")).toBe(false);
    expect(passwordMeetsPolicy("1234567890")).toBe(true);
  });

  it("treats the new password as reused when it matches the temp password", () => {
    const temp = "TempPass12";
    expect(isReusableTempPassword(temp, temp)).toBe(true);
    expect(isReusableTempPassword(`${temp}!`, temp)).toBe(false);
    expect(MIN_NEW_PASSWORD).toBe(10);
  });
});
