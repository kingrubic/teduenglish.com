"use client";

import { useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { api } from "@/convex/_generated/api";
import { formatBytes } from "@/convex/model";
import { downloadFile } from "@/lib/ui";
import { useSite } from "./SiteShell";

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
const MAX_FIT_WIDTH = 1000;

export default function DocReader({ id, onClose }: { id: string; onClose: () => void }) {
  const { token, toast } = useSite();
  const doc = useQuery(api.site.document, token === undefined ? "skip" : { token: token ?? undefined, id });
  const [zoom, setZoom] = useState(1);
  const zi = ZOOMS.indexOf(zoom);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const file = doc?.file;
  return (
    <section className="doc-pane" aria-label="Xem tài liệu PDF">
      <div className="doc-bar">
        <div className="doc-title">
          <p className="eyebrow">
            {doc?.folderName || "Tài liệu"} · PDF{file ? ` · ${formatBytes(file.size)}` : ""}
          </p>
          <h2 title={doc?.title}>{doc?.title ?? "Đang mở tài liệu…"}</h2>
        </div>
        <div className="doc-tools">
          <span className="zoom" role="group" aria-label="Thu phóng">
            <button type="button" onClick={() => setZoom(ZOOMS[zi - 1])} disabled={zi <= 0} aria-label="Thu nhỏ">
              −
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setZoom(ZOOMS[zi + 1])} disabled={zi >= ZOOMS.length - 1} aria-label="Phóng to">
              +
            </button>
          </span>
          {file?.url && (
            <>
              <button
                className="btn btn-primary btn-sm"
                type="button"
                onClick={() => {
                  toast("Đang tải file về…");
                  downloadFile(file.url!, file.name);
                }}
              >
                Tải về
              </button>
              <a className="btn btn-ghost btn-sm" href={file.url} target="_blank" rel="noopener noreferrer">
                Tab mới ↗
              </a>
            </>
          )}
          <button className="btn btn-ghost btn-sm" type="button" onClick={onClose} aria-label="Đóng tài liệu">
            Đóng ✕
          </button>
        </div>
      </div>
      {doc === undefined ? (
        <p className="doc-msg muted">Đang mở tài liệu…</p>
      ) : !file?.url ? (
        <div className="doc-msg">
          <p className="empty">Không mở được tài liệu này. Có thể tài liệu đã bị xoá hoặc em chưa được giao thư mục này.</p>
        </div>
      ) : (
        <PdfPages key={file.url} url={file.url} zoom={zoom} />
      )}
    </section>
  );
}

function PdfPages({ url, zoom }: { url: string; zoom: number }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [ratio, setRatio] = useState(1.414); // height / width of page 1, used for placeholders
  const [error, setError] = useState(false);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | undefined;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const task = pdfjs.getDocument({ url });
        destroy = () => void task.destroy();
        const d = await task.promise;
        if (cancelled) return;
        const first = (await d.getPage(1)).getViewport({ scale: 1 });
        setRatio(first.height / first.width);
        setPdf(d);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [url]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth - 32));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pageWidth = Math.max(200, Math.round(Math.min(width, MAX_FIT_WIDTH) * zoom));

  return (
    <div className="doc-scroll" ref={scrollRef}>
      {error ? (
        <div className="doc-msg">
          <p className="empty">Trình duyệt chưa hiển thị được file này. Em bấm “Tải về” hoặc “Tab mới” để xem nhé.</p>
        </div>
      ) : !pdf || !width ? (
        <p className="doc-msg muted">Đang tải trang…</p>
      ) : (
        Array.from({ length: pdf.numPages }, (_, i) => (
          <PdfPage key={i} pdf={pdf} n={i + 1} width={pageWidth} ratio={ratio} root={scrollRef} />
        ))
      )}
    </div>
  );
}

/** One page, rendered only once it scrolls near the viewport. */
function PdfPage({ pdf, n, width, ratio: fallbackRatio, root }: { pdf: PDFDocumentProxy; n: number; width: number; ratio: number; root: React.RefObject<HTMLDivElement | null> }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(n <= 2);
  const [ratio, setRatio] = useState(fallbackRatio);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || near) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), { root: root.current, rootMargin: "800px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [near, root]);

  useEffect(() => {
    if (!near) return;
    let task: RenderTask | undefined;
    let cancelled = false;
    (async () => {
      const page = await pdf.getPage(n);
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      setRatio(base.height / base.width);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: (width / base.width) * dpr });
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      task = page.render({ canvas, viewport });
      await task.promise.catch(() => {});
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [near, pdf, n, width]);

  return (
    <div className="doc-page" ref={boxRef} style={{ width, height: Math.round(width * ratio) }}>
      <canvas ref={canvasRef} aria-label={`Trang ${n}`} />
      <span className="pg-num">
        {n}/{pdf.numPages}
      </span>
    </div>
  );
}
