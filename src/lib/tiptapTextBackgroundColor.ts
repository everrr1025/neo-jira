import { Mark, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    textBackgroundColor: {
      setTextBackgroundColor: (color: string) => ReturnType;
      unsetTextBackgroundColor: () => ReturnType;
    };
  }
}

export const TiptapTextBackgroundColor = Mark.create({
  name: "textBackgroundColor",

  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element) => element.style.backgroundColor || null,
        renderHTML: (attributes) => {
          if (!attributes.color) {
            return {};
          }

          return {
            style: `background-color: ${attributes.color}`,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        style: "background-color",
        getAttrs: (value) => {
          if (typeof value !== "string" || !value.trim()) {
            return false;
          }

          return { color: value };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setTextBackgroundColor:
        (color: string) =>
        ({ commands }) => {
          if (!color.trim()) {
            return false;
          }

          return commands.setMark(this.name, { color });
        },
      unsetTextBackgroundColor:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});
