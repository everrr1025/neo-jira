"use client";

import dynamic from "next/dynamic";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";

const MDEditor = dynamic(
  () => import("@uiw/react-md-editor").then((mod) => mod.default),
  { ssr: false }
);

interface RichTextEditorProps {
  value: string;
  onChange: (val?: string) => void;
  readOnly?: boolean;
  height?: number;
}

export default function RichTextEditor({ value, onChange, readOnly = false, height = 200 }: RichTextEditorProps) {
  return (
    <div data-color-mode="light" className="w-full">
      <MDEditor
        value={value || ""}
        onChange={(val) => onChange(val)}
        preview={readOnly ? "preview" : "live"}
        hideToolbar={readOnly}
        height={readOnly ? undefined : height}
        visibleDragbar={!readOnly}
        className={readOnly ? "border-none shadow-none bg-transparent" : ""}
      />
    </div>
  );
}
