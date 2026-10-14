import type { Metadata } from "next";
import ParentPage from "@/components/parent/ParentPage";

export const metadata: Metadata = { title: "Phụ huynh theo dõi · TEDU English", robots: { index: false, follow: false } };

export default function Page() {
  return <ParentPage />;
}
