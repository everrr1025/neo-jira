import { Extension } from "@tiptap/core";
import type { EditorState, SelectionRange } from "@tiptap/pm/state";

type TextAlignValue = "left" | "center" | "right";
type TextAlignNodeAttrs = Record<string, unknown> & {
  containerStyle?: string;
  textAlign?: TextAlignValue;
};

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
      types: ["heading", "paragraph", "bulletList", "orderedList", "listItem", "blockquote", "imageResize"],
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

              const nextAttrs: TextAlignNodeAttrs = {
                ...node.attrs,
                textAlign: alignment,
              };

              if (node.type.name === 'imageResize') {
                 const containerStr = typeof nextAttrs.containerStyle === "string" ? nextAttrs.containerStyle : "";
                 let newContainerStyle = containerStr.replace(/margin:\s*[^;]+;?/g, '').trim();
                 if (newContainerStyle && !newContainerStyle.endsWith(';')) newContainerStyle += ';';
                 
                 if (alignment === 'center') {
                   newContainerStyle += ' margin: 0 auto;';
                 } else if (alignment === 'right') {
                   newContainerStyle += ' margin: 0 0 0 auto;';
                 } else if (alignment === 'left') {
                   newContainerStyle += ' margin: 0 auto 0 0;';
                 }
                 nextAttrs.containerStyle = newContainerStyle.trim();
              }

              tr.setNodeMarkup(pos, undefined, nextAttrs);
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

              const nextAttrs: TextAlignNodeAttrs = { ...node.attrs };
              delete nextAttrs.textAlign;

              if (node.type.name === 'imageResize') {
                 const containerStr = typeof nextAttrs.containerStyle === "string" ? nextAttrs.containerStyle : "";
                 const newContainerStyle = containerStr.replace(/margin:\s*[^;]+;?/g, '').trim();
                 nextAttrs.containerStyle = newContainerStyle;
              }

              tr.setNodeMarkup(pos, undefined, nextAttrs);
            });
          }

          return true;
        },
    };
  },
});
