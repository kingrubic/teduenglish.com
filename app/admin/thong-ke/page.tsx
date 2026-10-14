import { Suspense } from "react";
import Stats from "@/components/admin/Stats";

export default function Page() {
  return (
    <Suspense fallback={<p className="empty">Đang tải…</p>}>
      <Stats />
    </Suspense>
  );
}
