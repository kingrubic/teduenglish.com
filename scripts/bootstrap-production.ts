import bcrypt from "bcryptjs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

async function main() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password || password.length < 12)
    throw new Error(
      "Set BOOTSTRAP_ADMIN_EMAIL and a password of at least 12 characters",
    );
  const url = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
  if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  const client = new ConvexHttpClient(url);
  await client.mutation(api.seed.bootstrapAdmin, {
    email,
    passwordHash: await bcrypt.hash(password, 12),
  });
  console.log("Production administrator created");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
