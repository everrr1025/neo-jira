import Image, { type ImageOptions } from "@tiptap/extension-image";
import type { Editor } from "@tiptap/core";
import type { Attrs, Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";

const MOBILE_BREAKPOINT = 768;
const BORDER_COLOR = "#6C6C6C";
const DEFAULT_MIN_WIDTH = 100;
const ACTIVE_BORDER_WIDTH = 2;
const DOT_SIZE = {
  mobile: 16,
  desktop: 9,
} as const;
const DOT_POSITION = {
  mobile: "-8px",
  desktop: "-4px",
} as const;

type ResizeLimits = {
  minWidth?: number;
  maxWidth?: number;
};

type ImageResizeOptions = ImageOptions & ResizeLimits;

type ImageNodeViewContext = {
  node: ProseMirrorNode;
  editor: Editor;
  view: EditorView;
  getPos?: () => number | undefined;
};

type ImageElements = {
  wrapper: HTMLDivElement;
  container: HTMLDivElement;
  img: HTMLImageElement;
};

function isMobileViewport() {
  return document.documentElement.clientWidth < MOBILE_BREAKPOINT;
}

function getDotPosition() {
  return isMobileViewport() ? DOT_POSITION.mobile : DOT_POSITION.desktop;
}

function getDotSize() {
  return isMobileViewport() ? DOT_SIZE.mobile : DOT_SIZE.desktop;
}

function clearContainerBorder(container: HTMLDivElement) {
  const nextStyle = container.style.cssText
    .replace("border: 1px dashed #6C6C6C;", "")
    .replace("border: 1px dashed rgb(108, 108, 108);", "")
    .trim();

  container.style.cssText = nextStyle;
}

function removeResizeElements(container: HTMLDivElement) {
  while (container.childElementCount > 1) {
    container.removeChild(container.lastElementChild as ChildNode);
  }
}

function clampWidth(width: number, limits: ResizeLimits) {
  const absoluteMin = limits.minWidth !== undefined ? Math.max(0, limits.minWidth) : 0;
  let clampedWidth = Math.max(absoluteMin, width);

  if (limits.maxWidth !== undefined && clampedWidth > limits.maxWidth) {
    clampedWidth = limits.maxWidth;
  }

  return clampedWidth;
}

function getEditorContentWidth(element: HTMLElement) {
  const contentElement = element.closest(".neo-rich-text-editor__content") as HTMLElement | null;
  const availableWidth = contentElement?.clientWidth ?? element.parentElement?.clientWidth;

  if (!availableWidth) {
    return undefined;
  }

  return Math.max(0, availableWidth - ACTIVE_BORDER_WIDTH);
}

class StyleManager {
  static getContainerStyle(inline: boolean, width?: string) {
    const baseStyle = width
      ? `width: ${width}; max-width: 100%; height: auto; cursor: pointer;`
      : "max-width: 100%; height: auto; cursor: pointer;";
    const inlineStyle = inline ? "display: inline-block;" : "";

    return `${baseStyle} ${inlineStyle}`.trim();
  }

  static getWrapperStyle(inline: boolean) {
    return inline ? "display: inline-block; float: left; padding-right: 8px;" : "display: flex";
  }

  static normalizeContainerStyle(style: string, inline: boolean) {
    const widthIsFullLine = /width:\s*100%;?/i.test(style);
    const nextStyle = widthIsFullLine ? style.replace(/width:\s*100%;?/gi, "").trim() : style.trim();

    return StyleManager.getContainerStyle(
      inline,
      widthIsFullLine ? undefined : AttributeParser.extractWidthFromStyle(nextStyle) ?? undefined,
    )
      .concat(nextStyle ? ` ${nextStyle}` : "")
      .replace(/\s+/g, " ")
      .trim();
  }

  static getDotStyle(index: number) {
    const dotPosition = getDotPosition();
    const dotSize = getDotSize();
    const positions = [
      `top: ${dotPosition}; left: ${dotPosition}; cursor: nwse-resize;`,
      `top: ${dotPosition}; right: ${dotPosition}; cursor: nesw-resize;`,
      `bottom: ${dotPosition}; left: ${dotPosition}; cursor: nesw-resize;`,
      `bottom: ${dotPosition}; right: ${dotPosition}; cursor: nwse-resize;`,
    ];

    return `
      position: absolute;
      width: ${dotSize}px;
      height: ${dotSize}px;
      border: 1.5px solid ${BORDER_COLOR};
      border-radius: 50%;
      ${positions[index]}
    `
      .replace(/\s+/g, " ")
      .trim();
  }
}

class AttributeParser {
  static parseImageAttributes(nodeAttrs: Attrs, imgElement: HTMLImageElement) {
    Object.entries(nodeAttrs).forEach(([key, value]) => {
      if (value === undefined || value === null || key === "wrapperStyle") {
        return;
      }

      if (key === "containerStyle") {
        const width = String(value).match(/width:\s*([0-9.]+)px/);

        if (width) {
          imgElement.setAttribute("width", width[1]);
        }

        return;
      }

      imgElement.setAttribute(key, String(value));
    });
  }

  static extractWidthFromStyle(style: string) {
    const width = style.match(/width:\s*([0-9.]+)px/);

    return width ? width[1] : null;
  }
}

class ResizeController {
  private state = {
    isResizing: false,
    startX: 0,
    startWidth: 0,
  };

  constructor(
    private readonly elements: Pick<ImageElements, "container" | "img">,
    private readonly dispatchNodeView: () => void,
    private readonly getResizeLimits: () => ResizeLimits,
  ) {}

  private handleMouseMove = (event: MouseEvent, index: number) => {
    if (!this.state.isResizing) {
      return;
    }

    const deltaX =
      index % 2 === 0 ? -(event.clientX - this.state.startX) : event.clientX - this.state.startX;
    const newWidth = clampWidth(this.state.startWidth + deltaX, this.getResizeLimits());

    this.elements.container.style.width = `${newWidth}px`;
    this.elements.img.style.width = `${newWidth}px`;
  };

  private handleMouseUp = () => {
    if (this.state.isResizing) {
      this.state.isResizing = false;
    }

    this.dispatchNodeView();
  };

  private handleTouchMove = (event: TouchEvent, index: number) => {
    if (!this.state.isResizing) {
      return;
    }

    const deltaX =
      index % 2 === 0
        ? -(event.touches[0].clientX - this.state.startX)
        : event.touches[0].clientX - this.state.startX;
    const newWidth = clampWidth(this.state.startWidth + deltaX, this.getResizeLimits());

    this.elements.container.style.width = `${newWidth}px`;
    this.elements.img.style.width = `${newWidth}px`;
  };

  private handleTouchEnd = () => {
    if (this.state.isResizing) {
      this.state.isResizing = false;
    }

    this.dispatchNodeView();
  };

  createResizeHandle(index: number) {
    const dot = document.createElement("div");
    dot.setAttribute("style", StyleManager.getDotStyle(index));

    dot.addEventListener("mousedown", (event) => {
      event.preventDefault();
      this.state.isResizing = true;
      this.state.startX = event.clientX;
      this.state.startWidth = this.elements.container.offsetWidth;

      const onMouseMove = (nextEvent: MouseEvent) => this.handleMouseMove(nextEvent, index);
      const onMouseUp = () => {
        this.handleMouseUp();
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });

    dot.addEventListener(
      "touchstart",
      (event) => {
        if (event.cancelable) {
          event.preventDefault();
        }

        this.state.isResizing = true;
        this.state.startX = event.touches[0].clientX;
        this.state.startWidth = this.elements.container.offsetWidth;

        const onTouchMove = (nextEvent: TouchEvent) => this.handleTouchMove(nextEvent, index);
        const onTouchEnd = () => {
          this.handleTouchEnd();
          document.removeEventListener("touchmove", onTouchMove);
          document.removeEventListener("touchend", onTouchEnd);
        };

        document.addEventListener("touchmove", onTouchMove);
        document.addEventListener("touchend", onTouchEnd);
      },
      { passive: false },
    );

    return dot;
  }
}

class ImageNodeView {
  private readonly elements: ImageElements;

  private readonly handleContainerClick = () => {
    if (isMobileViewport()) {
      document.querySelector<HTMLElement>(".ProseMirror-focused")?.blur();
    }

    removeResizeElements(this.elements.container);
    this.elements.container.style.cssText = [
      "position: relative;",
      `border: 1px dashed ${BORDER_COLOR};`,
      this.getContainerStyle(),
    ]
      .filter(Boolean)
      .join(" ");

    this.applyResizeLimits();
    this.createResizeHandlers();
  };

  private readonly handleDocumentClick = (event: MouseEvent) => {
    if (this.elements.container.contains(event.target as Node)) {
      return;
    }

    clearContainerBorder(this.elements.container);
    removeResizeElements(this.elements.container);
  };

  constructor(
    private readonly context: ImageNodeViewContext,
    private readonly inline: boolean,
    private readonly resizeLimits: ResizeLimits = {},
  ) {
    this.elements = {
      wrapper: document.createElement("div"),
      container: document.createElement("div"),
      img: document.createElement("img"),
    };
  }

  private getNodeAttrs() {
    return this.context.node.attrs as Attrs & {
      containerStyle?: string | null;
      wrapperStyle?: string | null;
      width?: number | string | null;
    };
  }

  private getContainerStyle() {
    const attrs = this.getNodeAttrs();

    if (attrs.containerStyle) {
      return StyleManager.normalizeContainerStyle(attrs.containerStyle, this.inline);
    }

    const width = attrs.width ? `${attrs.width}px` : undefined;
    return StyleManager.getContainerStyle(this.inline, width);
  }

  private getEffectiveResizeLimits() {
    const editorMaxWidth = getEditorContentWidth(this.elements.container);
    const configuredMaxWidth = this.resizeLimits.maxWidth;
    const maxWidth =
      editorMaxWidth === undefined
        ? configuredMaxWidth
        : configuredMaxWidth === undefined
          ? editorMaxWidth
          : Math.min(configuredMaxWidth, editorMaxWidth);

    return {
      minWidth: this.resizeLimits.minWidth ?? DEFAULT_MIN_WIDTH,
      maxWidth,
    };
  }

  private setupImageAttributes() {
    AttributeParser.parseImageAttributes(this.getNodeAttrs(), this.elements.img);
    this.elements.img.style.display = "block";
    this.elements.img.style.height = "auto";
    this.elements.img.style.maxWidth = "100%";
  }

  private setupDOMStructure() {
    const attrs = this.getNodeAttrs();

    this.elements.wrapper.setAttribute(
      "style",
      attrs.wrapperStyle || StyleManager.getWrapperStyle(this.inline),
    );
    this.elements.wrapper.appendChild(this.elements.container);
    this.elements.container.setAttribute("style", this.getContainerStyle());
    this.elements.container.appendChild(this.elements.img);
  }

  private applyResizeLimits() {
    let widthStr = AttributeParser.extractWidthFromStyle(this.elements.container.style.cssText);

    if (widthStr === null) {
      const currentWidth =
        this.elements.img.getBoundingClientRect().width || this.elements.container.getBoundingClientRect().width;

      if (!currentWidth) {
        return;
      }

      widthStr = currentWidth.toString();
    }

    const width = Number(widthStr);

    if (Number.isNaN(width)) {
      return;
    }

    const clampedWidth = clampWidth(width, this.getEffectiveResizeLimits());
    const clampedPx = `${clampedWidth}px`;

    this.elements.container.style.width = clampedPx;
    this.elements.img.style.width = clampedPx;
    this.elements.img.setAttribute("width", String(clampedWidth));
  }

  private dispatchNodeView = () => {
    const { view, getPos } = this.context;

    if (typeof getPos !== "function") {
      return;
    }

    const pos = getPos();

    if (pos === undefined) {
      return;
    }

    clearContainerBorder(this.elements.container);

    const attrs = this.getNodeAttrs();
    const nextAttrs = {
      ...attrs,
      width:
        AttributeParser.extractWidthFromStyle(this.elements.container.style.cssText) ?? attrs.width,
      containerStyle: this.elements.container.style.cssText,
      wrapperStyle: this.elements.wrapper.style.cssText,
    };

    view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, nextAttrs));
  };

  private createResizeHandlers() {
    const resizeController = new ResizeController(
      this.elements,
      this.dispatchNodeView,
      () => this.getEffectiveResizeLimits(),
    );

    Array.from({ length: 4 }, (_, index) => {
      this.elements.container.appendChild(resizeController.createResizeHandle(index));
    });
  }

  initialize() {
    this.setupDOMStructure();
    this.setupImageAttributes();
    this.applyResizeLimits();

    if (!this.context.editor.options.editable) {
      return {
        dom: this.elements.container,
      };
    }

    this.elements.container.addEventListener("click", this.handleContainerClick);
    document.addEventListener("click", this.handleDocumentClick);

    return {
      dom: this.elements.wrapper,
      destroy: () => {
        this.elements.container.removeEventListener("click", this.handleContainerClick);
        document.removeEventListener("click", this.handleDocumentClick);
      },
    };
  }
}

export const TiptapImageResize = Image.extend<ImageResizeOptions>({
  name: "imageResize",

  addOptions() {
    const parentOptions = this.parent?.() ?? {
      allowBase64: false,
      HTMLAttributes: {},
      inline: false,
      resize: false,
    };

    return {
      ...parentOptions,
      inline: false,
      minWidth: DEFAULT_MIN_WIDTH,
      maxWidth: undefined,
    };
  },

  addAttributes() {
    const inline = this.options.inline as boolean;

    return {
      ...(this.parent?.() ?? {}),
      containerStyle: {
        default: StyleManager.getContainerStyle(inline),
        parseHTML: (element: HTMLElement) => {
          const containerStyle = element.getAttribute("containerstyle");

          if (containerStyle) {
            return containerStyle;
          }

          const width = element.getAttribute("width");
          return width ? StyleManager.getContainerStyle(inline, `${width}px`) : element.style.cssText;
        },
      },
      wrapperStyle: {
        default: StyleManager.getWrapperStyle(inline),
      },
    };
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const nodeView = new ImageNodeView(
        {
          node,
          editor,
          view: editor.view,
          getPos: typeof getPos === "function" ? getPos : undefined,
        },
        this.options.inline as boolean,
        {
          minWidth: this.options.minWidth as number | undefined,
          maxWidth: this.options.maxWidth as number | undefined,
        },
      );

      return nodeView.initialize();
    };
  },
});

export default TiptapImageResize;
