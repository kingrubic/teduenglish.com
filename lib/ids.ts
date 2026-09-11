import { z } from "zod";

export const idSchema = z.string().min(8);
export const optionalId = z
  .string()
  .optional()
  .or(z.literal(""))
  .transform((value) => (value ? value : undefined));

export function dueAtMs(value?: string) {
  if (!value) return undefined;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : undefined;
}
