import { redirect } from "next/navigation";
import type { Actor } from "./auth";
import { requireActor, requireSessionHash } from "./auth";
import { MENU_ITEMS } from "./menu";
import { api, convex } from "./convex";

export function canManage(actor: Actor) {
  return actor.role === "ADMIN" || actor.role === "MOD";
}
export function ownsStudentRecord(actor: Actor, studentId: string) {
  return actor.role === "USER" && actor.id === studentId;
}

export async function getAccessibleMenuKeys(actor: Actor): Promise<Set<string>> {
  if (actor.role === "ADMIN") return new Set(MENU_ITEMS.map((item) => item.key));
  if (actor.role === "MOD")
    return new Set(
      MENU_ITEMS.filter((item) => item.scope === "cms" && !item.adminOnly).map(
        (item) => item.key,
      ),
    );
  const tokenHash = await requireSessionHash();
  const keys = await convex().query(api.auth.accessibleMenuKeys, { tokenHash });
  if (keys === "ALL_ADMIN") return new Set(MENU_ITEMS.map((item) => item.key));
  if (keys === "ALL_MOD")
    return new Set(
      MENU_ITEMS.filter((item) => item.scope === "cms" && !item.adminOnly).map(
        (item) => item.key,
      ),
    );
  return new Set(Array.isArray(keys) ? keys : []);
}

export async function requireMenuAccess(menuKey: string) {
  const actor = await requireActor();
  const keys = await getAccessibleMenuKeys(actor);
  if (!keys.has(menuKey)) redirect("/khong-co-quyen");
  return actor;
}
