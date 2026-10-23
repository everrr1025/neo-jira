"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ExternalLink, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Locale } from "@/lib/i18n";

export default function KnowledgeImagePreview({ src, title, locale }: { src: string; title: string; locale: Locale }) {
  const t = (zh: string, en: string) => locale === "zh" ? zh : en;
  const [open, setOpen] = useState(false);
  const [natural, setNatural] = useState({ width: 1000, height: 700 });
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const fitScale = useRef(1);
  useEffect(() => {
    if (!open || !viewport) return;
    const fit = () => {
      fitScale.current = Math.min(viewport.clientWidth / natural.width, viewport.clientHeight / natural.height, 1);
      setScale(fitScale.current);
    };
    const observer = new ResizeObserver(fit);
    observer.observe(viewport, { box: "border-box" });
    fit();
    return () => observer.disconnect();
  }, [natural, open, viewport]);

  return <>
    <button type="button" className="absolute inset-0 cursor-zoom-in focus-visible:outline-2 focus-visible:outline-ring" aria-label={t("放大查看图片", "Enlarge image")} onClick={() => setOpen(true)}>
      <Image unoptimized src={src} alt={title} width={1000} height={700} className="absolute inset-0 m-auto h-auto w-auto max-h-full max-w-full" onLoad={(event) => setNatural({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} />
    </button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="flex h-[90dvh] w-[96vw] max-w-none flex-col gap-3 p-4 sm:max-w-none" aria-describedby={undefined}>
      <DialogHeader className="shrink-0 pr-8"><DialogTitle className="truncate">{title}</DialogTitle></DialogHeader>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon-sm" disabled={scale <= 0.05} aria-label={t("缩小", "Zoom out")} onClick={() => setScale((value) => Math.max(0.05, value / 1.25))}><ZoomOut /></Button>
        <span className="min-w-12 text-center text-sm tabular-nums" aria-live="polite">{Math.round(scale * 100)}%</span>
        <Button variant="ghost" size="icon-sm" disabled={scale >= 4} aria-label={t("放大", "Zoom in")} onClick={() => setScale((value) => Math.min(4, value * 1.25))}><ZoomIn /></Button>
        <Button variant="ghost" size="sm" onClick={() => setScale(fitScale.current)}>{t("适应窗口", "Fit to window")}</Button>
        <Button variant="ghost" size="sm" onClick={() => setScale(1)}>100%</Button>
        <Button asChild variant="ghost" size="sm" className="ml-auto"><a href={src} target="_blank" rel="noreferrer"><ExternalLink />{t("查看原图", "Open original")}</a></Button>
      </div>
      <div ref={setViewport} className="min-h-0 flex-1 overflow-auto rounded-md bg-muted/30" aria-label={t("图片预览", "Image preview")}>
        <div className="grid min-h-full min-w-full place-items-center" style={{ width: natural.width * scale, height: natural.height * scale }}>
          <Image unoptimized src={src} alt={title} width={natural.width} height={natural.height} className="max-w-none" style={{ width: natural.width * scale, height: natural.height * scale }} />
        </div>
      </div>
    </DialogContent></Dialog>
  </>;
}
