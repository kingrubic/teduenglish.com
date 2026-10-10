import { Suspense } from "react";
import Results from "@/components/admin/Results";

export default function Page() {
  return (
    <Suspense fallback={<p className="empty">Đang tải…</p>}>
      <Results />
    </Suspense>
  );
}
