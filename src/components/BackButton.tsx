"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function BackButton({ label = "Back", fallbackHref }: { label?: string; fallbackHref?: string }) {
  const router = useRouter();

  const handleBack = () => {
    if (fallbackHref && window.history.length <= 1) {
      router.push(fallbackHref);
      return;
    }
    router.back();
  };

  return (
    <button
      onClick={handleBack}
      className="text-sm font-medium text-slate-500 hover:text-blue-600 flex items-center gap-1 w-fit transition-colors"
    >
      <ArrowLeft size={16} /> {label}
    </button>
  );
}
