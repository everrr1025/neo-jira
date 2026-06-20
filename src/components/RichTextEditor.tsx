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
import { createPortal } from "react-dom";
import { EditorContent, type Editor, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  CaseSensitive,
  ChevronDown,
  Highlighter,
  Italic,
  Link2,
  Image as ImageIcon,
  List,
  ListOrdered,
  Maximize2,
  Minimize2,
  Strikethrough,
  X,
} from "lucide-react";
import MarkdownIt from "markdown-it";
import { TiptapImageResize } from "@/lib/tiptapImageResize";
import { TiptapTextColor } from "@/lib/tiptapTextColor";
import { TiptapTextBackgroundColor } from "@/lib/tiptapTextBackgroundColor";
import { TiptapTextAlign } from "@/lib/tiptapTextAlign";

export type RichTextEditorMentionUser = {
  id: string;
  name: string | null;
};

export type RichTextEditorIssueMentionOption = {
  id: string;
  key: string;
  title: string;
  projectKey?: string | null;
};

interface RichTextEditorProps {
  value: string;
  onChange: (val: string) => void;
  readOnly?: boolean;
  height?: number;
  mentionUsers?: RichTextEditorMentionUser[];
  mentionLabel?: string;
  issueMentionOptions?: RichTextEditorIssueMentionOption[];
  issueMentionLabel?: string;
  onIssueLinkClick?: (issueId: string) => void;
  currentUserId?: string;
  borderless?: boolean;
  toolbarRight?: ReactNode;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  fullscreenLabel?: string;
  exitFullscreenLabel?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  onEscapeKeyDown?: () => void;
}

export type RichTextEditorHandle = {
  commitPendingUploads: () => void;
  discardPendingUploads: () => Promise<void>;
  focus: () => void;
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

type PreviewImage = {
  src: string;
  alt: string;
} | null;

type MentionMenuItem =
  | {
      kind: "user";
      id: string;
      label: string;
    }
  | {
      kind: "issue";
      id: string;
      key: string;
      title: string;
      projectKey?: string | null;
    };

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

function getCurrentTextBackgroundColor(editor: Editor) {
  return (editor.getAttributes("textBackgroundColor").color as string | undefined) || null;
}

function getImageElement(target: HTMLElement | null) {
  const element = target?.closest("img");
  return element instanceof HTMLImageElement ? element : null;
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
      className={`inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-xs font-semibold transition-colors ${
        active
          ? "border border-blue-200 bg-blue-50 text-blue-700"
          : "border border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900"
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

const PRESET_BACKGROUND_COLORS = [
  { label: "White", value: "#ffffff" },
  { label: "Yellow", value: "#fef08a" },
  { label: "Green", value: "#bbf7d0" },
  { label: "Blue", value: "#bfdbfe" },
  { label: "Pink", value: "#fbcfe8" },
  { label: "Purple", value: "#ddd6fe" },
  { label: "Gray", value: "#e2e8f0" },
];

function ColorPickerButton({
  value,
  fallbackValue,
  onApplyLast,
  onSelectPreset,
  title = "Text color",
  colors = PRESET_COLORS,
  icon,
}: {
  value: string | null;
  fallbackValue: string;
  onApplyLast: () => void;
  onSelectPreset: (color: string) => void;
  title?: string;
  colors?: Array<{ label: string; value: string }>;
  icon?: ReactNode;
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
    <div className="relative inline-flex h-7 rounded-md" ref={containerRef}>
      <button
        type="button"
        title={title}
        onMouseDown={(e) => {
          e.preventDefault();
          onApplyLast();
        }}
        className="inline-flex h-7 min-w-7 items-center justify-center rounded-l-md px-1.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
      >
        {icon || (
          <div
            className="h-4 w-4 rounded border border-slate-300 shadow-sm transition-transform active:scale-90"
            style={{ backgroundColor: value || fallbackValue }}
          />
        )}
      </button>
      <button
        type="button"
        title={`${title} options`}
        aria-label={`${title} options`}
        onMouseDown={(e) => {
          e.preventDefault();
          setIsOpen(!isOpen);
        }}
        className={`inline-flex h-7 w-4 items-center justify-center rounded-r-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 ${
          isOpen ? "bg-slate-100 text-slate-900" : ""
        }`}
      >
        <ChevronDown size={12} />
      </button>

      {isOpen && (
        <div className="absolute left-1/2 top-full z-[70] mt-1.5 flex -translate-x-1/2 gap-1.5 rounded-lg border border-slate-200 bg-white p-2.5 shadow-xl animate-in fade-in zoom-in-95 duration-100">
          {colors.map((color) => (
            <button
              key={color.value}
              type="button"
              title={color.label}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelectPreset(color.value);
                setIsOpen(false);
              }}
              className={`h-5 w-5 rounded-full border border-slate-200 transition-transform hover:scale-110 ${
                value === color.value ? "ring-2 ring-blue-300 ring-offset-1" : ""
              }`}
              style={{ backgroundColor: color.value }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ColorToolIcon({ children, color, iconOffsetClass = "" }: { children: ReactNode; color: string; iconOffsetClass?: string }) {
  return (
    <span className="relative block h-5 w-5">
      <span className={`absolute left-1/2 top-0 flex h-[14px] -translate-x-1/2 items-center justify-center leading-none ${iconOffsetClass}`}>
        {children}
      </span>
      <span
        className="absolute bottom-0 left-1/2 block h-[3px] w-4 -translate-x-1/2 rounded-none border-0"
        style={{ backgroundColor: color }}
      />
    </span>
  );
}

function MenuBar({
  editor,
  onInsertLink,
  onInsertImage,
  currentTextColor,
  currentTextBackgroundColor,
  lastTextColor,
  lastTextBackgroundColor,
  onApplyLastColor,
  onApplyLastBackgroundColor,
  onSelectPresetColor,
  onSelectPresetBackgroundColor,
  borderless = false,
  toolbarRight,
  isFullscreen = false,
  onToggleFullscreen,
  fullscreenLabel = "Fullscreen",
  exitFullscreenLabel = "Exit fullscreen",
}: {
  editor: Editor;
  onInsertLink: () => void;
  onInsertImage: () => void;
  currentTextColor: string | null;
  currentTextBackgroundColor: string | null;
  lastTextColor: string;
  lastTextBackgroundColor: string;
  onApplyLastColor: () => void;
  onApplyLastBackgroundColor: () => void;
  onSelectPresetColor: (color: string) => void;
  onSelectPresetBackgroundColor: (color: string) => void;
  borderless?: boolean;
  toolbarRight?: ReactNode;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  fullscreenLabel?: string;
  exitFullscreenLabel?: string;
}) {
  const currentAlignment = getCurrentAlignment(editor);

  return (
    <div className={`flex min-h-10 w-full flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 ${borderless ? "m-0 px-2 py-1.5" : "px-2 py-1.5"}`}>
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
      <ToolbarButton
        active={editor.isActive("strike")}
        title="Strikethrough"
        onMouseDown={(event) => {
          event.preventDefault();
          editor.chain().focus().toggleStrike().run();
        }}
      >
        <Strikethrough size={16} strokeWidth={2.5} />
      </ToolbarButton>

      <div className="mx-1 h-4 w-px bg-slate-300" />

      <ToolbarButton
        active={editor.isActive("heading", { level: 1 })}
        title="Heading 1"
        onMouseDown={(event) => {
          event.preventDefault();
          editor.chain().focus().toggleHeading({ level: 1 }).run();
        }}
      >
        H1
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("heading", { level: 2 })}
        title="Heading 2"
        onMouseDown={(event) => {
          event.preventDefault();
          editor.chain().focus().toggleHeading({ level: 2 }).run();
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
        <List size={16} />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("orderedList")}
        title="Ordered list"
        onMouseDown={(event) => {
          event.preventDefault();
          editor.chain().focus().toggleOrderedList().run();
        }}
      >
        <ListOrdered size={16} />
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
        fallbackValue={lastTextColor}
        onApplyLast={onApplyLastColor}
        onSelectPreset={onSelectPresetColor}
        icon={
          <ColorToolIcon color={currentTextColor || lastTextColor} iconOffsetClass="translate-y-px">
            <CaseSensitive size={16} />
          </ColorToolIcon>
        }
      />
      <ColorPickerButton
        value={lastTextBackgroundColor}
        fallbackValue={lastTextBackgroundColor}
        onApplyLast={onApplyLastBackgroundColor}
        title="Text background"
        colors={PRESET_BACKGROUND_COLORS}
        onSelectPreset={onSelectPresetBackgroundColor}
        icon={
          <ColorToolIcon color={lastTextBackgroundColor}>
            <Highlighter size={16} />
          </ColorToolIcon>
        }
      />
      <div className="ml-auto flex h-full items-center gap-1 px-3">
        {onToggleFullscreen ? (
          <ToolbarButton
            title={isFullscreen ? exitFullscreenLabel : fullscreenLabel}
            onMouseDown={(event) => {
              event.preventDefault();
              onToggleFullscreen();
            }}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </ToolbarButton>
        ) : null}
        {toolbarRight}
      </div>
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

function getIssueIdFromLinkElement(element: HTMLElement | null) {
  const link = element?.closest("a[href]") as HTMLAnchorElement | null;
  if (!link) return null;

  const dataIssueId = link.dataset.issueId;
  if (dataIssueId) return dataIssueId;

  const rawHref = link.getAttribute("href") || "";
  const baseUrl = typeof window === "undefined" ? "http://localhost" : window.location.origin;
  const href = new URL(rawHref, baseUrl);
  const issueMatch = href.pathname.match(/^\/issues\/([^/?#]+)/);
  return issueMatch?.[1] || null;
}

const RichTextEditor = forwardRef(function RichTextEditor(
  {
    value,
    onChange,
    readOnly = false,
    height = 200,
    mentionUsers = [],
    mentionLabel = "Mention someone",
    issueMentionOptions = [],
    issueMentionLabel = "Mention issue",
    onIssueLinkClick,
    currentUserId,
    borderless = false,
    toolbarRight,
    isFullscreen = false,
    onToggleFullscreen,
    fullscreenLabel,
    exitFullscreenLabel,
    onFocus,
    onBlur,
    onEscapeKeyDown,
  }: RichTextEditorProps,
  ref: ForwardedRef<RichTextEditorHandle>,
) {
  const [, setUiVersion] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const [mentionState, setMentionState] = useState<MentionState>(null);
  const [previewImage, setPreviewImage] = useState<PreviewImage>(null);
  const [containerElement, setContainerElement] = useState<HTMLDivElement | null>(null);
  const [lastTextColor, setLastTextColor] = useState(PRESET_COLORS[0].value);
  const [lastTextBackgroundColor, setLastTextBackgroundColor] = useState(PRESET_BACKGROUND_COLORS[1].value);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const lastSelectionRef = useRef<SelectionSnapshot>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingUploadedImageUrlsRef = useRef(new Set<string>());
  const latestContentRef = useRef(value || "");
  const lastExternalValueRef = useRef(value || "");
  const editorInstanceRef = useRef<Editor | null>(null);
  const mentionStateRef = useRef<MentionState>(null);
  const mentionMenuItemsRef = useRef<MentionMenuItem[]>([]);
  const selectedMentionIndexRef = useRef(0);
  const onChangeRef = useRef(onChange);
  const onFocusRef = useRef(onFocus);
  const onBlurRef = useRef(onBlur);
  const onEscapeKeyDownRef = useRef(onEscapeKeyDown);
  const onIssueLinkClickRef = useRef(onIssueLinkClick);

  useEffect(() => {
    onChangeRef.current = onChange;
    onFocusRef.current = onFocus;
    onBlurRef.current = onBlur;
    onEscapeKeyDownRef.current = onEscapeKeyDown;
    onIssueLinkClickRef.current = onIssueLinkClick;
  }, [onBlur, onChange, onEscapeKeyDown, onFocus, onIssueLinkClick]);

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
    focus: () => editorInstanceRef.current?.chain().focus("end").run(),
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

  const handleIssueLinkEvent = (event: MouseEvent) => {
    const handleIssueLinkClick = onIssueLinkClickRef.current;
    const issueId = getIssueIdFromLinkElement(event.target as HTMLElement | null);
    if (!issueId || !handleIssueLinkClick) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();
    handleIssueLinkClick(issueId);
    return true;
  };

  const handleImagePreviewEvent = (event: MouseEvent) => {
    if (!readOnly) {
      return false;
    }

    const image = getImageElement(event.target as HTMLElement | null);
    if (!image?.src) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();
    setPreviewImage({
      src: image.currentSrc || image.src,
      alt: image.alt || "",
    });
    return true;
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
      TiptapTextBackgroundColor,
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
      handleKeyDown: (_view, event) => {
        if (event.key === "Escape" && !readOnly) {
          const handleEscapeKeyDown = onEscapeKeyDownRef.current;
          handleEscapeKeyDown?.();
          return Boolean(handleEscapeKeyDown);
        }

        const currentMentionState = mentionStateRef.current;
        const currentMentionItems = mentionMenuItemsRef.current;

        if (currentMentionState && currentMentionItems.length > 0) {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const direction = event.key === "ArrowDown" ? 1 : -1;
            const nextIndex =
              (selectedMentionIndexRef.current + direction + currentMentionItems.length) %
              currentMentionItems.length;
            selectedMentionIndexRef.current = nextIndex;
            setSelectedMentionIndex(nextIndex);
            return true;
          }

          if (event.key === "Enter") {
            event.preventDefault();
            const selectedItem = currentMentionItems[selectedMentionIndexRef.current] || currentMentionItems[0];
            if (selectedItem) {
              insertMentionItem(selectedItem, currentMentionState);
            }
            return true;
          }

          if (event.key === "Escape") {
            event.preventDefault();
            setMentionState(null);
            return true;
          }
        }

        if (event.key !== "Tab") {
          return false;
        }

        event.preventDefault();

        const activeEditor = editorInstanceRef.current;
        if (!activeEditor || activeEditor.isDestroyed) {
          return true;
        }

        if (event.shiftKey) {
          if (activeEditor.can().liftListItem("listItem")) {
            activeEditor.chain().focus().liftListItem("listItem").run();
          }
          return true;
        }

        if (activeEditor.can().sinkListItem("listItem")) {
          activeEditor.chain().focus().sinkListItem("listItem").run();
          return true;
        }

        activeEditor.chain().focus().insertContent("    ").run();
        return true;
      },
      handleClick: (_view, _pos, event) => {
        if (handleImagePreviewEvent(event)) {
          return true;
        }
        return handleIssueLinkEvent(event);
      },
      handleDOMEvents: {
        click: (_view, event) => handleImagePreviewEvent(event) || handleIssueLinkEvent(event),
      },
    },
    content: contentToHTML(value || ""),
    parseOptions: {
      preserveWhitespace: "full",
    },
    onUpdate: ({ editor: nextEditor }) => {
      const serializedContent = serializeContent(nextEditor);
      lastExternalValueRef.current = serializedContent;
      cleanupRemovedPendingUploads(serializedContent);
      onChangeRef.current(serializedContent);
    },
    immediatelyRender: false,
  }, [readOnly]);

  useEffect(() => {
    editorInstanceRef.current = editor;
    return () => {
      if (editorInstanceRef.current === editor) {
        editorInstanceRef.current = null;
      }
    };
  }, [editor]);

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
    const handleFocus = () => {
      syncEditorUi();
      onFocusRef.current?.();
    };

    syncEditorUi();
    editor.on("selectionUpdate", syncEditorUi);
    editor.on("transaction", syncEditorUi);
    editor.on("focus", handleFocus);
    editor.on("blur", syncEditorUi);

    return () => {
      editor.off("selectionUpdate", syncEditorUi);
      editor.off("transaction", syncEditorUi);
      editor.off("focus", handleFocus);
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
    if (nextValue === lastExternalValueRef.current) {
      latestContentRef.current = nextValue;
      cleanupRemovedPendingUploads(nextValue);
      return;
    }

    lastExternalValueRef.current = nextValue;
    const currentValue = serializeContent(editor);
    latestContentRef.current = nextValue;

    if (nextValue === currentValue) {
      cleanupRemovedPendingUploads(nextValue);
      return;
    }

    editor.commands.setContent(contentToHTML(nextValue), {
      emitUpdate: false,
      parseOptions: { preserveWhitespace: "full" },
    });
    cleanupRemovedPendingUploads(nextValue);
  }, [value, editor]);

  useEffect(
    () => () => {
      void discardPendingUploads();
    },
    [],
  );

  const mentionMenuItems: MentionMenuItem[] =
    mentionState === null
      ? []
      : issueMentionOptions.length > 0
        ? mentionState.query.trim()
          ? issueMentionOptions
              .filter((issue) => {
                const query = mentionState.query.trim().toLowerCase();
                return `${issue.key} ${issue.title} ${issue.projectKey || ""}`.toLowerCase().includes(query);
              })
              .slice(0, 8)
              .map((issue) => ({
                kind: "issue" as const,
                id: issue.id,
                key: issue.key,
                title: issue.title,
                projectKey: issue.projectKey,
              }))
          : []
        : mentionUsers
            .filter((user) => {
              const trimmedName = user.name?.trim();
              if (!trimmedName) {
                return false;
              }

              if (currentUserId && user.id === currentUserId) {
                return false;
              }

              return trimmedName.toLowerCase().includes(mentionState.query.toLowerCase());
            })
            .slice(0, 8)
            .map((user) => ({
              kind: "user" as const,
              id: user.id,
              label: user.name || user.id,
            }));
  const currentTextColor = editor ? getCurrentTextColor(editor) : null;
  const currentTextBackgroundColor = editor ? getCurrentTextBackgroundColor(editor) : null;
  const mentionPosition = getMentionPosition(editor, mentionState, containerElement);

  useEffect(() => {
    mentionStateRef.current = mentionState;
  }, [mentionState]);

  useEffect(() => {
    mentionMenuItemsRef.current = mentionMenuItems;
    if (selectedMentionIndexRef.current >= mentionMenuItems.length) {
      selectedMentionIndexRef.current = 0;
    }
  }, [mentionMenuItems]);

  function insertMentionItem(item: MentionMenuItem, state: NonNullable<MentionState>) {
    const activeEditor = editorInstanceRef.current;
    if (!activeEditor || activeEditor.isDestroyed) {
      return;
    }

    if (item.kind === "issue") {
      activeEditor
        .chain()
        .focus()
        .insertContentAt(
          {
            from: state.from,
            to: state.to,
          },
          [
            {
              type: "text",
              text: item.key,
              marks: [
                {
                  type: "link",
                  attrs: {
                    href: `/issues/${item.id}`,
                  },
                },
              ],
            },
            {
              type: "text",
              text: " ",
            },
          ],
        )
        .run();
    } else {
      activeEditor
        .chain()
        .focus()
        .insertContentAt(
          {
            from: state.from,
            to: state.to,
          },
          `@${item.label} `,
        )
        .run();
    }

    setMentionState(null);
    selectedMentionIndexRef.current = 0;
    setSelectedMentionIndex(0);
  }

  const handleInsertMention = (item: MentionMenuItem) => {
    if (!mentionState) {
      return;
    }

    insertMentionItem(item, mentionState);
  };

  const activeMentionLabel = issueMentionOptions.length > 0 ? issueMentionLabel : mentionLabel;

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

    setLastTextColor(color);
    const chain = editor.chain().focus();
    if (lastSelectionRef.current) {
      chain.setTextSelection(lastSelectionRef.current);
    }

    chain.setTextColor(color).run();
  };

  const handleSelectPresetBackgroundColor = (color: string) => {
    if (!editor) {
      return;
    }

    if (color !== "transparent") {
      setLastTextBackgroundColor(color);
    }
    const chain = editor.chain().focus();
    if (lastSelectionRef.current) {
      chain.setTextSelection(lastSelectionRef.current);
    }

    if (color === "transparent") {
      chain.unsetTextBackgroundColor().run();
      return;
    }

    chain.setTextBackgroundColor(color).run();
  };

  const handleApplyLastTextColor = () => {
    handleSelectPresetColor(lastTextColor);
  };

  const handleApplyLastTextBackgroundColor = () => {
    handleSelectPresetBackgroundColor(lastTextBackgroundColor);
  };

  return (
    <div
      className={`relative h-full w-full ${mentionState ? "z-50" : "z-10"}`}
      ref={setContainerElement}
      onBlurCapture={(event) => {
        const handleBlur = onBlurRef.current;
        if (readOnly || !handleBlur) return;
        const container = event.currentTarget;
        const nextFocusedElement = event.relatedTarget as Node | null;
        if (nextFocusedElement && container.contains(nextFocusedElement)) return;
        window.setTimeout(() => {
          const activeElement = document.activeElement;
          if (activeElement && container.contains(activeElement)) return;
          handleBlur();
        }, 0);
      }}
    >
      <div
        className={`h-full w-full ${readOnly ? "neo-rich-text-editor--readonly" : ""} ${
          readOnly
            ? ""
            : borderless
              ? "neo-rich-text-editor flex h-full flex-col overflow-hidden bg-white"
            : "neo-rich-text-editor flex h-full flex-col overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm transition-[border-color,box-shadow] focus-within:border-slate-400 focus-within:shadow-[0_0_0_3px_rgba(148,163,184,0.18)]"
        }`}
      >
        {!readOnly && editor && (
          <MenuBar
            editor={editor}
            onInsertLink={handleInsertLink}
            onInsertImage={handleInsertImageClick}
            currentTextColor={currentTextColor}
            currentTextBackgroundColor={currentTextBackgroundColor}
            lastTextColor={lastTextColor}
            lastTextBackgroundColor={lastTextBackgroundColor}
            onApplyLastColor={handleApplyLastTextColor}
            onApplyLastBackgroundColor={handleApplyLastTextBackgroundColor}
            onSelectPresetColor={handleSelectPresetColor}
            onSelectPresetBackgroundColor={handleSelectPresetBackgroundColor}
            borderless={borderless}
            toolbarRight={toolbarRight}
            isFullscreen={isFullscreen}
            onToggleFullscreen={onToggleFullscreen}
            fullscreenLabel={fullscreenLabel}
            exitFullscreenLabel={exitFullscreenLabel}
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
          className={readOnly ? "" : `neo-rich-text-editor__scroll min-h-0 flex-1 cursor-text bg-white ${borderless ? "neo-rich-text-editor__scroll--borderless" : ""}`}
          style={readOnly ? undefined : borderless ? { height: "100%" } : { minHeight: `${height}px`, height: "100%" }}
          onClick={() => {
            if (!readOnly) {
              editor?.chain().focus().run();
            }
          }}
        >
          <EditorContent editor={editor} className={readOnly ? "" : "h-full"} />
        </div>
      </div>

      {!readOnly && editor && isFocused && mentionState !== null && mentionMenuItems.length > 0 && mentionPosition && (
        <div
          className="absolute z-[100] w-80 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
          style={{
            top: `${mentionPosition.top}px`,
            left: `${mentionPosition.left}px`,
          }}
        >
          <div className="border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-500">
            {activeMentionLabel}
          </div>
          <div className="max-h-48 overflow-y-auto">
            {mentionMenuItems.map((item, index) => {
              const isSelected = index === selectedMentionIndex;
              return (
                <button
                  type="button"
                  key={`${item.kind}-${item.id}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => {
                    selectedMentionIndexRef.current = index;
                    setSelectedMentionIndex(index);
                  }}
                  onClick={() => handleInsertMention(item)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                    isSelected ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                  }`}
                >
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    item.kind === "issue" ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-600"
                  }`}>
                    {item.kind === "issue" ? "#" : item.label.charAt(0) || "U"}
                  </div>
                  {item.kind === "issue" ? (
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{item.key}</span>
                      <span className="block truncate text-xs text-slate-500">{item.title}</span>
                    </span>
                  ) : (
                    <span className="truncate">{item.label}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {previewImage && typeof document !== "undefined" ? createPortal(
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-md bg-white/10 text-white transition-colors hover:bg-white/20"
            onClick={() => setPreviewImage(null)}
            aria-label="Close image preview"
            title="Close image preview"
          >
            <X size={20} />
          </button>
          <img
            src={previewImage.src}
            alt={previewImage.alt}
            className="h-[90vh] w-[90vw] rounded-md object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>,
        document.body
      ) : null}
    </div>
  );
});

RichTextEditor.displayName = "RichTextEditor";

export default RichTextEditor;
