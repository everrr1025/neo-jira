import { Extension } from "@tiptap/core";
import type { EditorState, SelectionRange } from "@tiptap/pm/state";

type TextAlignValue = "left" | "center" | "right";

function collectTargetNodePositions(state: EditorState, types: string[]) {
  const positions = new Set<number>();

  const collectFromRangeBoundaries = (range: SelectionRange) => {
    for (let depth = range.$from.depth; depth > 0; depth -= 1) {
      const fromNode = range.$from.node(depth);
      if (types.includes(fromNode.type.name)) {
        positions.add(range.$from.before(depth));
      }
    }

    for (let depth = range.$to.depth; depth > 0; depth -= 1) {
      const toNode = range.$to.node(depth);
      if (types.includes(toNode.type.name)) {
        positions.add(range.$to.before(depth));
      }
    }
  };

  state.selection.ranges.forEach((range) => {
    collectFromRangeBoundaries(range);

    state.doc.nodesBetween(range.$from.pos, range.$to.pos, (node, pos) => {
      if (types.includes(node.type.name)) {
        positions.add(pos);
      }
    });
  });

  return positions;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    textAlign: {
      setTextAlign: (alignment: TextAlignValue) => ReturnType;
      unsetTextAlign: () => ReturnType;
    };
  }
}

export const TiptapTextAlign = Extension.create({
  name: "textAlign",

  addOptions() {
    return {
      alignments: ["left", "center", "right"] as TextAlignValue[],
      defaultAlignment: null as TextAlignValue | null,
      types: ["heading", "paragraph", "bulletList", "orderedList", "listItem", "blockquote"],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          textAlign: {
            default: this.options.defaultAlignment,
            parseHTML: (element) => {
              const alignment = element.style.textAlign as TextAlignValue;
              return this.options.alignments.includes(alignment) ? alignment : this.options.defaultAlignment;
            },
            renderHTML: (attributes) => {
              if (!attributes.textAlign || attributes.textAlign === this.options.defaultAlignment) {
                return {};
              }

              return {
                style: `text-align: ${attributes.textAlign}`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setTextAlign:
        (alignment) =>
        ({ tr, state, dispatch }) => {
          if (!this.options.alignments.includes(alignment)) {
            return false;
          }

          const positions = collectTargetNodePositions(state, this.options.types);

          if (positions.size === 0) {
            return false;
          }

          if (dispatch) {
            positions.forEach((pos) => {
              const node = tr.doc.nodeAt(pos);
              if (!node) {
                return;
              }

              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                textAlign: alignment,
              });
            });
          }

          return true;
        },
      unsetTextAlign:
        () =>
        ({ tr, state, dispatch }) => {
          const positions = collectTargetNodePositions(state, this.options.types);

          if (positions.size === 0) {
            return false;
          }

          if (dispatch) {
            positions.forEach((pos) => {
              const node = tr.doc.nodeAt(pos);
              if (!node) {
                return;
              }

              const nextAttrs = { ...node.attrs };
              delete nextAttrs.textAlign;

              tr.setNodeMarkup(pos, undefined, nextAttrs);
            });
          }

          return true;
        },
    };
  },
});
