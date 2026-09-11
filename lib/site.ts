import { api, convex } from "@/lib/convex";

export type SiteSettings = {
  tenantId: string;
  brandName: string;
  tagline: string;
  teacherName: string;
  teacherTitle: string;
  teacherOrganization: string;
  teacherShortBio: string;
  teacherLongBio: string;
  contactEmail: string | null;
  contactPhone: string | null;
  seoTitle: string;
  seoDescription: string;
};

export async function getSiteSettings(): Promise<SiteSettings> {
  const settings = await convex().query(api.auth.siteSettings, {});
  if (!settings) throw new Error("Site settings have not been configured");
  return settings;
}
