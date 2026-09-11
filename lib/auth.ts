import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { api, convex } from "./convex";
import type { Id } from "@/convex/_generated/dataModel";

export type Actor = {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: "ADMIN" | "MOD" | "USER";
};

export const COOKIE = "elh_session";
export const hashToken = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export async function sessionToken() {
  return (await cookies()).get(COOKIE)?.value ?? null;
}

export async function sessionHash() {
  const token = await sessionToken();
  return token ? hashToken(token) : null;
}

export async function requireSessionHash() {
  const tokenHash = await sessionHash();
  if (!tokenHash) redirect("/dang-nhap");
  return tokenHash;
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  await convex().mutation(api.auth.createSession, {
    userId: userId as Id<"users">,
    tokenHash: hashToken(token),
  });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 604800,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token)
    await convex().mutation(api.auth.destroySession, {
      tokenHash: hashToken(token),
    });
  jar.delete(COOKIE);
}

export async function getActor(): Promise<Actor | null> {
  const tokenHash = await sessionHash();
  if (!tokenHash) return null;
  return convex().query(api.auth.getActor, { tokenHash });
}

export async function requireActor(roles?: Actor["role"][]) {
  const actor = await getActor();
  if (!actor) redirect("/dang-nhap");
  if (roles && !roles.includes(actor.role)) redirect("/khong-co-quyen");
  return actor;
}
