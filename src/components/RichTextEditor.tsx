"use client";

import { EditorContent, type Editor, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Link2,
  Palette,
  Quote,
} from "lucide-react";
import MarkdownIt from "markdown-it";
import { type ChangeEvent, type MouseEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { TiptapTextColor } from "@/lib/tiptapTextColor";
import { TiptapTextAlign } from "@/lib/tiptapTextAlign";

export type RichTextEditorMentionUser = {
  id: string;
  name: string | null;
};

interface RichTextEditorProps {
  value: string;
  onChange: (val: string) => void;
  readOnly?: boolean;
  height?: number;
  mentionUsers?: RichTextEditorMentionUser[];
  mentionLabel?: string;
  currentUserId?: string;
}

type TextAlignValue = "left" | "center" | "right";

type MentionState = {
  query: string;
  from: number;
  to: number;
} | null;

type SelectionSnapshot = {
  from: number;
  to: number;
} | null;

const markdownParser = new MarkdownIt({
  html: true,
  breaks: true,
  linkify: true,
});

function looksLikeHTML(content: string) {
  return /<\/?[a-z][\s\S]*>/i.test(content);
}

function contentToHTML(content: string) {
  const trimmedContent = content.trim();

  if (!trimmedContent) {
    return "<p></p>";
  }

  return looksLikeHTML(trimmedContent) ? trimmedContent : markdownParser.render(trimmedContent);
}

function serializeContent(editor: Editor) {
  const plainText = editor.getText({ blockSeparator: "\n" }).trim();
  return plainText ? editor.getHTML() : "";
}

function getMentionState(editor: Editor): MentionState {
  if (!editor.isEditable || !editor.state.selection.empty) {
    return null;
  }

  const { from, $from } = editor.state.selection;
  const textBeforeCursor = $from.parent.textBetween(0, $from.parentOffset, "\n", " ");
  const match = textBeforeCursor.match(/(?:^|\s)@([^\s@]*)$/);

  if (!match) {
    return null;
  }

  return {
    query: match[1],
    from: from - match[1].length - 1,
    to: from,
  };
}

function getCurrentAlignment(editor: Editor): TextAlignValue {
  const alignments = [
    editor.getAttributes("paragraph").textAlign,
    editor.getAttributes("heading").textAlign,
    editor.getAttributes("bulletList").textAlign,
    editor.getAttributes("orderedList").textAlign,
    editor.getAttributes("listItem").textAlign,
    editor.getAttributes("blockquote").textAlign,
  ] as Array<TextAlignValue | undefined>;

  return alignments.find(Boolean) || "left";
}

function getCurrentTextColor(editor: Editor) {
  return (editor.getAttributes("textColor").color as string | undefined) || null;
}

function normalizeColorValue(color: string | null) {
  if (!color) {
    return "#0f172a";
  }

  if (/^#[0-9a-f]{6}$/i.test(color)) {
    return color;
  }

  if (/^#[0-9a-f]{3}$/i.test(color)) {
    return `#${color
      .slice(1)
      .split("")
      .map((character) => `${character}${character}`)
      .join("")}`;
  }

  const rgbMatch = color.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
  if (!rgbMatch) {
    return "#0f172a";
  }

  return `#${rgbMatch
    .slice(1)
    .map((value) => Number(value).toString(16).padStart(2, "0"))
    .join("")}`;
}

type ToolbarButtonProps = {
  active?: boolean;
  title: string;
  onMouseDown: (event: MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
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

const PRESET_COLORS = [
  { label: "Default", value: "#0f172a" },
  { label: "Gray", value: "#64748b" },
  { label: "Red", value: "#ef4444" },
  { label: "Orange", value: "#f97316" },
  { label: "Amber", value: "#f59e0b" },
  { label: "Green", value: "#22c55e" },
  { label: "Blue", value: "#3b82f6" },
];

function ColorPickerButton({
  value,
  onSelectPreset,
}: {
  value: string | null;
  onSelectPreset: (color: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: globalThis.MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <ToolbarButton
        active={isOpen}
        title="Text color"
        onMouseDown={(e) => {
          e.preventDefault();
          setIsOpen(!isOpen);
        }}
      >
        <div
          className="h-4 w-4 rounded border border-slate-300 shadow-sm transition-transform active:scale-90"
          style={{ backgroundColor: value || "#0f172a" }}
        />
      </ToolbarButton>

      {isOpen && (
        <div className="absolute left-1/2 top-full z-[70] mt-1.5 flex -translate-x-1/2 gap-1.5 rounded-lg border border-slate-200 bg-white p-2.5 shadow-xl animate-in fade-in zoom-in-95 duration-100">
          {PRESET_COLORS.map((color) => (
            <button
              key={color.value}
              type="button"
              title={color.label}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelectPreset(color.value);
                setIsOpen(false);
              }}
              className={`h-5 w-5 rounded-full border border-slate-200 transition-transform hover:scale-125 ${
                value === color.value ? "ring-2 ring-blue-500 ring-offset-1" : ""
              }`}
              style={{ backgroundColor: color.value }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MenuBar({
  editor,
  onInsertLink,
  currentTextColor,
  onSelectPresetColor,
}: {
  editor: Editor;
  onInsertLink: () => void;
  currentTextColor: string | null;
  onSelectPresetColor: (color: string) => void;
}) {
  const currentAlignment = getCurrentAlignment(editor);

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 px-2 py-2">
      <ToolbarButton
        active={editor.isActive("bold")}
        title="Bold"
        onMouseDown={(event) => {
          event.preventDefault();
          editor.chain().focus().toggleBold().run();
        }}
      >
        <Bold size={16} strokeWidth={2.5} />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("italic")}
        title="Italic"
        onMouseDown={(event) => {
          event.preventDefault();
          editor.chain().focus().toggleItalic().run();
        }}
      >
        <Italic size={16} strokeWidth={2.5} />
      </ToolbarButton>

      <div className="mx-1 h-4 w-px bg-slate-300" />

      <ToolbarButton
        active={editor.isActive("heading", { level: 1 })}
        title="Heading 1"
        onMouseDown={(event) => {
          event.preventDefault();
          editor.chain().focus().setHeading({ level: 1 }).run();
        }}
      >
        H1
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("heading", { level: 2 })}
        title="Heading 2"
        onMouseDown={(event) => {
          event.preventDefault();
          editor.chain().focus().setHeading({ level: 2 }).run();
        }}
      >
        H2
      </ToolbarButton>

      <div className="mx-1 h-4 w-px bg-slate-300" />

      <ToolbarButton
        active={editor.isActive("bulletList")}
        title="Bullet list"
        onMouseDown={(event) => {
          event.preventDefault();
          editor.chain().focus().toggleBulletList().run();
        }}
      >
        UL
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("orderedList")}
        title="Ordered list"
        onMouseDown={(event) => {
          event.preventDefault();
          editor.chain().focus().toggleOrderedList().run();
        }}
      >
        OL
      </ToolbarButton>

      <div className="mx-1 h-4 w-px bg-slate-300" />

      <ToolbarButton
        active={currentAlignment === "left"}
        title="Align left"
        onMouseDown={(event) => {
          event.preventDefault();
          editor.chain().focus().setTextAlign("left").run();
        }}
      >
        <AlignLeft size={16} />
      </ToolbarButton>
      <ToolbarButton
        active={currentAlignment === "center"}
        title="Align center"
        onMouseDown={(event) => {
          event.preventDefault();
          editor.chain().focus().setTextAlign("center").run();
        }}
      >
        <AlignCenter size={16} />
      </ToolbarButton>
      <ToolbarButton
        active={currentAlignment === "right"}
        title="Align right"
        onMouseDown={(event) => {
          event.preventDefault();
          editor.chain().focus().setTextAlign("right").run();
        }}
      >
        <AlignRight size={16} />
      </ToolbarButton>

      <div className="mx-1 h-4 w-px bg-slate-300" />

      <ToolbarButton
        active={editor.isActive("link")}
        title="Insert link"
        onMouseDown={(event) => {
          event.preventDefault();
          onInsertLink();
        }}
      >
        <Link2 size={16} />
      </ToolbarButton>

      <div className="mx-1 h-4 w-px bg-slate-300" />

      <ColorPickerButton
        value={currentTextColor}
        onSelectPreset={onSelectPresetColor}
      />
    </div>
  );
}

export default function RichTextEditor({
  value,
  onChange,
  readOnly = false,
  height = 200,
  mentionUsers = [],
  mentionLabel = "Mention someone",
  currentUserId,
}: RichTextEditorProps) {
  const [, setUiVersion] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const [mentionState, setMentionState] = useState<MentionState>(null);
  const [mentionPosition, setMentionPosition] = useState<{ top: number; left: number } | null>(null);
  const lastSelectionRef = useRef<SelectionSnapshot>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2],
        },
        link: {
          autolink: true,
          linkOnPaste: true,
          openOnClick: false,
        },
      }),
      TiptapTextColor,
      TiptapTextAlign,
    ],
    editable: !readOnly,
    editorProps: {
      attributes: {
        className:
          "neo-rich-text-editor__content h-full w-full overflow-y-auto text-slate-800 focus:outline-none",
      },
    },
    content: contentToHTML(value || ""),
    onUpdate: ({ editor: nextEditor }) => {
      onChange(serializeContent(nextEditor));
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    const syncEditorUi = () => {
      setUiVersion((currentValue) => currentValue + 1);
      setIsFocused(editor.isFocused);
      setMentionState(getMentionState(editor));
      lastSelectionRef.current = {
        from: editor.state.selection.from,
        to: editor.state.selection.to,
      };
    };

    syncEditorUi();
    editor.on("selectionUpdate", syncEditorUi);
    editor.on("transaction", syncEditorUi);
    editor.on("focus", syncEditorUi);
    editor.on("blur", syncEditorUi);

    return () => {
      editor.off("selectionUpdate", syncEditorUi);
      editor.off("transaction", syncEditorUi);
      editor.off("focus", syncEditorUi);
      editor.off("blur", syncEditorUi);
    };
  }, [editor]);

  useEffect(() => {
    if (!editor || !mentionState || !containerRef.current) {
      setMentionPosition(null);
      return;
    }

    try {
      const { view } = editor;
      const { from } = mentionState;
      const coords = view.coordsAtPos(from);
      const containerRect = containerRef.current.getBoundingClientRect();

      setMentionPosition({
        top: coords.bottom - containerRect.top + 4,
        left: coords.left - containerRect.left,
      });
    } catch (e) {
      setMentionPosition(null);
    }
  }, [editor, mentionState]);

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
    const currentValue = serializeContent(editor);

    if (nextValue === currentValue) {
      return;
    }

    editor.commands.setContent(contentToHTML(nextValue), { emitUpdate: false });
  }, [value, editor]);

  const filteredMentionUsers =
    mentionState === null
      ? []
      : mentionUsers.filter((user) => {
          const trimmedName = user.name?.trim();
          if (!trimmedName) {
            return false;
          }

          if (currentUserId && user.id === currentUserId) {
            return false;
          }

          return trimmedName.toLowerCase().includes(mentionState.query.toLowerCase());
        });
  const currentTextColor = editor ? getCurrentTextColor(editor) : null;

  const handleInsertMention = (name: string) => {
    if (!editor || !mentionState) {
      return;
    }

    editor
      .chain()
      .focus()
      .insertContentAt(
        {
          from: mentionState.from,
          to: mentionState.to,
        },
        `@${name} `,
      )
      .run();

    setMentionState(null);
  };

  const handleInsertLink = () => {
    if (!editor) {
      return;
    }

    const currentHref = editor.getAttributes("link").href as string | undefined;
    const rawUrl = window.prompt("Enter URL", currentHref || "https://");

    if (rawUrl === null) {
      return;
    }

    const trimmedUrl = rawUrl.trim();
    if (!trimmedUrl) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    const normalizedUrl = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmedUrl) ? trimmedUrl : `https://${trimmedUrl}`;

    if (editor.state.selection.empty && !editor.isActive("link")) {
      const rawLabel = window.prompt("Link text", normalizedUrl);

      if (rawLabel === null) {
        return;
      }

      const label = rawLabel.trim() || normalizedUrl;
      editor
        .chain()
        .focus()
        .insertContent({
          type: "text",
          text: label,
          marks: [
            {
              type: "link",
              attrs: {
                href: normalizedUrl,
              },
            },
          ],
        })
        .run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: normalizedUrl }).run();
  };

  const handleTextColorChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!editor) {
      return;
    }

    const chain = editor.chain().focus();
    if (lastSelectionRef.current) {
      chain.setTextSelection(lastSelectionRef.current);
    }

    chain.setTextColor(event.target.value).run();
  };

  const handleSelectPresetColor = (color: string) => {
    if (!editor) {
      return;
    }

    const chain = editor.chain().focus();
    if (lastSelectionRef.current) {
      chain.setTextSelection(lastSelectionRef.current);
    }

    chain.setTextColor(color).run();
  };

  return (
    <div className={`relative w-full ${mentionState ? "z-50" : "z-10"}`} ref={containerRef}>
      <div
        className={`w-full ${
          readOnly
            ? ""
            : "neo-rich-text-editor flex h-full flex-col overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm transition-[border-color,box-shadow] focus-within:border-slate-400 focus-within:shadow-[0_0_0_3px_rgba(148,163,184,0.18)]"
        }`}
      >
        {!readOnly && editor && (
          <MenuBar
            editor={editor}
            onInsertLink={handleInsertLink}
            currentTextColor={currentTextColor}
            onSelectPresetColor={handleSelectPresetColor}
          />
        )}
        <div
          className={readOnly ? "" : "neo-rich-text-editor__scroll min-h-0 cursor-text bg-white"}
          style={readOnly ? undefined : { minHeight: `${height}px`, height: "100%" }}
          onClick={() => {
            if (!readOnly) {
              editor?.chain().focus().run();
            }
          }}
        >
          <EditorContent editor={editor} className={readOnly ? "" : "h-full"} />
        </div>
      </div>

      {!readOnly && editor && isFocused && mentionState !== null && filteredMentionUsers.length > 0 && mentionPosition && (
        <div
          className="absolute z-[100] w-64 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
          style={{
            top: `${mentionPosition.top}px`,
            left: `${mentionPosition.left}px`,
          }}
        >
          <div className="border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-500">
            {mentionLabel}
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filteredMentionUsers.map((user) => {
              const displayName = user.name || user.id;

              return (
                <button
                  type="button"
                  key={user.id}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleInsertMention(displayName)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">
                    {displayName.charAt(0) || "U"}
                  </div>
                  {displayName}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
