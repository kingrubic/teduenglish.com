import type { Metadata } from "next";
import ClarifyPage from "@/components/clarify/ClarifyPage";

export const metadata: Metadata = { title: "Câu hỏi cho thầy · TEDU English", robots: { index: false, follow: false } };

export default function Page() {
  return <ClarifyPage />;
}
