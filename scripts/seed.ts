import bcrypt from "bcryptjs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

async function main() {
  if (process.env.NODE_ENV === "production")
    throw new Error("Development seed is disabled in production");
  const url = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
  if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  const client = new ConvexHttpClient(url);
  const passwordHash = await bcrypt.hash("Demo@12345", 12);
  const result = await client.mutation(api.seed.seedDev, { passwordHash });
  console.log(
    result.seeded
      ? "Seed complete: teacher@example.test (ADMIN), mod@example.test (MOD), student@example.test (USER), outsider@example.test (USER) / Demo@12345"
      : "Seed skipped: tenant already exists",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
