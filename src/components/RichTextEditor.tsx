"use client";

import {
  type ChangeEvent,
  type ForwardedRef,
  forwardRef,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { EditorContent, type Editor, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Link2,
  Image as ImageIcon,
} from "lucide-react";
import MarkdownIt from "markdown-it";
import { TiptapImageResize } from "@/lib/tiptapImageResize";
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

export type RichTextEditorHandle = {
  commitPendingUploads: () => void;
  discardPendingUploads: () => Promise<void>;
};

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
  const hasImages = editor.getHTML().includes('<img');
  return plainText || hasImages ? editor.getHTML() : "";
}

async function uploadImage(file: File): Promise<string | null> {
  const formData = new FormData();
  formData.append("file", file);
  try {
    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });
    if (!response.ok) throw new Error("Upload failed");
    const data = await response.json();
    return data.fileUrl;
  } catch (error) {
    console.error("Failed to upload image:", error);
    return null;
  }
}

async function deleteUploadedFile(fileUrl: string) {
  if (!fileUrl.startsWith("/uploads/")) {
    return;
  }

  try {
    const response = await fetch("/api/upload", {
      method: "DELETE",
      body: JSON.stringify({ fileUrl }),
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok && response.status !== 404) {
      console.error("Failed to cleanup uploaded image:", fileUrl, response.statusText);
    }
  } catch (error) {
    console.error("Failed to cleanup uploaded image:", error);
  }
}

function extractUploadUrlsFromContent(content: string) {
  const uploadUrls = new Set<string>();
  const imageSrcPattern = /<img\b[^>]*\bsrc=(['"])(.*?)\1/gi;

  for (const match of content.matchAll(imageSrcPattern)) {
    const src = match[2]?.trim();

    if (src?.startsWith("/uploads/")) {
      uploadUrls.add(src);
    }
  }

  return uploadUrls;
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
    editor.getAttributes("imageResize").textAlign,
  ] as Array<TextAlignValue | undefined>;

  return alignments.find(Boolean) || "left";
}

function getCurrentTextColor(editor: Editor) {
  return (editor.getAttributes("textColor").color as string | undefined) || null;
}

type ToolbarButtonProps = {
  active?: boolean;
  title: string;
  onMouseDown: (event: ReactMouseEvent<HTMLButtonElement>) => void;
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
  onInsertImage,
  currentTextColor,
  onSelectPresetColor,
}: {
  editor: Editor;
  onInsertLink: () => void;
  onInsertImage: () => void;
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
      <ToolbarButton
        active={editor.isActive("imageResize") || editor.isActive("image")}
        title="Insert image"
        onMouseDown={(event) => {
          event.preventDefault();
          onInsertImage();
        }}
      >
        <ImageIcon size={16} />
      </ToolbarButton>

      <div className="mx-1 h-4 w-px bg-slate-300" />

      <ColorPickerButton
        value={currentTextColor}
        onSelectPreset={onSelectPresetColor}
      />
    </div>
  );
}

function getMentionPosition(
  editor: Editor | null,
  mentionState: MentionState,
  container: HTMLDivElement | null,
) {
  if (!editor || !mentionState || !container) {
    return null;
  }

  try {
    const coords = editor.view.coordsAtPos(mentionState.from);
    const containerRect = container.getBoundingClientRect();

    return {
      top: coords.bottom - containerRect.top + 4,
      left: coords.left - containerRect.left,
    };
  } catch {
    return null;
  }
}

const RichTextEditor = forwardRef(function RichTextEditor(
  {
    value,
    onChange,
    readOnly = false,
    height = 200,
    mentionUsers = [],
    mentionLabel = "Mention someone",
    currentUserId,
  }: RichTextEditorProps,
  ref: ForwardedRef<RichTextEditorHandle>,
) {
  const [, setUiVersion] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const [mentionState, setMentionState] = useState<MentionState>(null);
  const [containerElement, setContainerElement] = useState<HTMLDivElement | null>(null);
  const lastSelectionRef = useRef<SelectionSnapshot>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingUploadedImageUrlsRef = useRef(new Set<string>());
  const latestContentRef = useRef(value || "");

  const cleanupRemovedPendingUploads = (content: string) => {
    latestContentRef.current = content;
    const currentUploadUrls = extractUploadUrlsFromContent(content);

    Array.from(pendingUploadedImageUrlsRef.current).forEach((fileUrl) => {
      if (currentUploadUrls.has(fileUrl)) {
        return;
      }

      pendingUploadedImageUrlsRef.current.delete(fileUrl);
      void deleteUploadedFile(fileUrl);
    });
  };

  const commitPendingUploads = () => {
    const persistedUploadUrls = extractUploadUrlsFromContent(latestContentRef.current);

    Array.from(pendingUploadedImageUrlsRef.current).forEach((fileUrl) => {
      pendingUploadedImageUrlsRef.current.delete(fileUrl);

      if (!persistedUploadUrls.has(fileUrl)) {
        void deleteUploadedFile(fileUrl);
      }
    });
  };

  const discardPendingUploads = async () => {
    const pendingFileUrls = Array.from(pendingUploadedImageUrlsRef.current);
    pendingUploadedImageUrlsRef.current.clear();

    await Promise.allSettled(pendingFileUrls.map((fileUrl) => deleteUploadedFile(fileUrl)));
  };

  useImperativeHandle(ref, () => ({
    commitPendingUploads,
    discardPendingUploads,
  }));

  const handleImageUpload = async (file: File, view: Editor["view"], pos: number | null = null) => {
    const url = await uploadImage(file);
    if (url) {
      const imageNode = view.state.schema.nodes.imageResize ?? view.state.schema.nodes.image;

      if (!imageNode) {
        void deleteUploadedFile(url);
        return;
      }

      pendingUploadedImageUrlsRef.current.add(url);

      if (pos !== null) {
        view.dispatch(view.state.tr.insert(pos, imageNode.create({ src: url })));
      } else {
        view.dispatch(view.state.tr.replaceSelectionWith(imageNode.create({ src: url })));
      }
    }
  };

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
      TiptapImageResize,
    ],
    editable: !readOnly,
    editorProps: {
      attributes: {
        className:
          "neo-rich-text-editor__content h-full w-full overflow-y-auto text-slate-800 focus:outline-none",
      },
      handlePaste: (view, event) => {
        if (event.clipboardData && event.clipboardData.files && event.clipboardData.files.length > 0) {
          const file = event.clipboardData.files[0];
          if (file.type.startsWith("image/")) {
            event.preventDefault();
            handleImageUpload(file, view, view.state.selection.from);
            return true;
          }
        }
        return false;
      },
      handleDrop: (view, event, _slice, moved) => {
        if (!moved && event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length > 0) {
          const file = event.dataTransfer.files[0];
          if (file.type.startsWith("image/")) {
            event.preventDefault();
            const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });
            handleImageUpload(file, view, coordinates?.pos);
            return true;
          }
        }
        return false;
      },
    },
    content: contentToHTML(value || ""),
    onUpdate: ({ editor: nextEditor }) => {
      const serializedContent = serializeContent(nextEditor);
      cleanupRemovedPendingUploads(serializedContent);
      onChange(serializedContent);
    },
    immediatelyRender: false,
  }, [readOnly]);

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
    latestContentRef.current = nextValue;

    if (nextValue === currentValue) {
      cleanupRemovedPendingUploads(nextValue);
      return;
    }

    editor.commands.setContent(contentToHTML(nextValue), { emitUpdate: false });
    cleanupRemovedPendingUploads(nextValue);
  }, [value, editor]);

  useEffect(
    () => () => {
      void discardPendingUploads();
    },
    [],
  );

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
  const mentionPosition = getMentionPosition(editor, mentionState, containerElement);

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

  const handleInsertImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && editor && !editor.isDestroyed) {
      const url = await uploadImage(file);
      if (url) {
        const imageNode = editor.state.schema.nodes.imageResize ?? editor.state.schema.nodes.image;

        if (!imageNode) {
          void deleteUploadedFile(url);
        } else {
          pendingUploadedImageUrlsRef.current.add(url);
          editor.chain().focus().setImage({ src: url }).run();
        }
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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
    <div className={`relative w-full ${mentionState ? "z-50" : "z-10"}`} ref={setContainerElement}>
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
            onInsertImage={handleInsertImageClick}
            currentTextColor={currentTextColor}
            onSelectPresetColor={handleSelectPresetColor}
          />
        )}
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          onChange={handleFileInputChange}
        />
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
});

RichTextEditor.displayName = "RichTextEditor";

export default RichTextEditor;
