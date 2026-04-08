"use client";

import { EditorContent, type Editor, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, Quote } from "lucide-react";
import MarkdownIt from "markdown-it";
import { MarkdownSerializer, defaultMarkdownSerializer } from "prosemirror-markdown";
import { useEffect } from "react";

interface RichTextEditorProps {
  value: string;
  onChange: (val: string) => void;
  readOnly?: boolean;
  height?: number;
}

const markdownParser = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: true,
});

const markdownSerializer = new MarkdownSerializer(
  {
    doc(state, node) {
      state.renderContent(node);
    },
    paragraph: defaultMarkdownSerializer.nodes.paragraph,
    blockquote: defaultMarkdownSerializer.nodes.blockquote,
    horizontalRule: defaultMarkdownSerializer.nodes.horizontal_rule,
    heading: defaultMarkdownSerializer.nodes.heading,
    codeBlock: defaultMarkdownSerializer.nodes.code_block,
    bulletList: defaultMarkdownSerializer.nodes.bullet_list,
    orderedList: defaultMarkdownSerializer.nodes.ordered_list,
    listItem: defaultMarkdownSerializer.nodes.list_item,
    text: defaultMarkdownSerializer.nodes.text,
    hardBreak: defaultMarkdownSerializer.nodes.hard_break,
  },
  {
    bold: defaultMarkdownSerializer.marks.strong,
    italic: defaultMarkdownSerializer.marks.em,
    code: defaultMarkdownSerializer.marks.code,
  },
);

function markdownToHTML(markdown: string) {
  if (!markdown.trim()) {
    return "<p></p>";
  }

  return markdownParser.render(markdown);
}

function serializeMarkdown(editor: Editor) {
  return markdownSerializer.serialize(editor.state.doc).trim();
}

type ToolbarButtonProps = {
  active?: boolean;
  title: string;
  onMouseDown: (event: React.MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
};

function ToolbarButton({ active = false, title, onMouseDown, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onMouseDown={onMouseDown}
      className={`inline-flex min-w-9 items-center justify-center rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? "bg-slate-900 text-white shadow-sm"
          : "text-slate-600 hover:bg-slate-200 hover:text-slate-900"
      }`}
      title={title}
      aria-label={title}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

const MenuBar = ({ editor }: { editor: Editor }) => {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 px-2 py-2">
      <ToolbarButton
        active={editor.isActive("bold")}
        title="加粗"
        onMouseDown={(event) => {
          event.preventDefault();
          editor.chain().focus().toggleBold().run();
        }}
      >
        <Bold size={16} strokeWidth={2.5} />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("italic")}
        title="斜体"
        onMouseDown={(event) => {
          event.preventDefault();
          editor.chain().focus().toggleItalic().run();
        }}
      >
        <Italic size={16} strokeWidth={2.5} />
      </ToolbarButton>

      <div className="w-px h-4 bg-slate-300 mx-1" />

      <ToolbarButton
        active={!editor.isActive("heading") && !editor.isActive("bulletList") && !editor.isActive("orderedList") && !editor.isActive("blockquote")}
        title="正文"
        onMouseDown={(event) => {
          event.preventDefault();
          editor.chain().focus().setParagraph().run();
        }}
      >
        P
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("heading", { level: 1 })}
        title="一级标题"
        onMouseDown={(event) => {
          event.preventDefault();
          editor.chain().focus().setHeading({ level: 1 }).run();
        }}
      >
        H1
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("heading", { level: 2 })}
        title="二级标题"
        onMouseDown={(event) => {
          event.preventDefault();
          editor.chain().focus().setHeading({ level: 2 }).run();
        }}
      >
        H2
      </ToolbarButton>

      <div className="w-px h-4 bg-slate-300 mx-1" />

      <ToolbarButton
        active={editor.isActive("bulletList")}
        title="无序列表"
        onMouseDown={(event) => {
          event.preventDefault();
          editor.chain().focus().toggleBulletList().run();
        }}
      >
        UL
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("orderedList")}
        title="有序列表"
        onMouseDown={(event) => {
          event.preventDefault();
          editor.chain().focus().toggleOrderedList().run();
        }}
      >
        OL
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("blockquote")}
        title="引用"
        onMouseDown={(event) => {
          event.preventDefault();
          editor.chain().focus().toggleBlockquote().run();
        }}
      >
        <Quote size={16} />
      </ToolbarButton>
    </div>
  );
};

export default function RichTextEditor({
  value,
  onChange,
  readOnly = false,
  height = 200,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2],
        },
      }),
    ],
    editable: !readOnly,
    editorProps: {
      attributes: {
        className: "neo-rich-text-editor__content h-full w-full overflow-y-auto px-4 py-3 text-slate-800 focus:outline-none",
      },
    },
    content: markdownToHTML(value || ""),
    onUpdate: ({ editor }) => {
      onChange(serializeMarkdown(editor));
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const nextValue = value || "";
    const currentValue = serializeMarkdown(editor);

    if (nextValue === currentValue) {
      return;
    }

    editor.commands.setContent(markdownToHTML(nextValue), { emitUpdate: false });
  }, [value, editor]);

  return (
    <div
      className={`w-full ${
        readOnly
          ? ""
          : "neo-rich-text-editor flex h-full flex-col overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm transition-[border-color,box-shadow] focus-within:border-slate-400 focus-within:shadow-[0_0_0_3px_rgba(148,163,184,0.18)]"
      }`}
    >
      {!readOnly && editor && <MenuBar editor={editor} />}
      <div
        className={readOnly ? "" : "neo-rich-text-editor__scroll min-h-0 cursor-text bg-white"}
        style={readOnly ? undefined : { minHeight: `${height}px`, height: "100%" }}
        onClick={() => {
          if (!readOnly) {
            editor?.chain().focus().run();
          }
        }}
      >
        <EditorContent editor={editor} className="h-full" />
      </div>
    </div>
  );
}
