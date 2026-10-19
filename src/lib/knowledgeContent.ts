import sanitizeHtml from "sanitize-html";

export const KNOWLEDGE_FILE_PREFIX = "/api/knowledge/files/";
export function knowledgeFileUrl(id: string) { return `${KNOWLEDGE_FILE_PREFIX}${encodeURIComponent(id)}`; }

export function cleanKnowledgeContent(html: string) {
  const references = new Set<string>();
  const content = sanitizeHtml(html, {
    allowedTags: ["p", "br", "strong", "em", "s", "u", "h1", "h2", "h3", "h4", "blockquote", "pre", "code", "ul", "ol", "li", "hr", "a", "img", "span", "table", "thead", "tbody", "tr", "td", "th"],
    allowedAttributes: { a: ["href", "title", "target", "rel"], img: ["src", "alt", "width", "height"], "*": ["style"] },
    allowedStyles: { "*": { "text-align": [/^(left|right|center|justify)$/], color: [/^#[0-9a-fA-F]{3,8}$/, /^rgb\([\d,\s]+\)$/], "background-color": [/^#[0-9a-fA-F]{3,8}$/, /^rgb\([\d,\s]+\)$/] } },
    allowedSchemes: ["https", "http", "mailto"],
    allowProtocolRelative: false,
    transformTags: {
      a: (_tag, attrs) => ({ tagName: "a", attribs: { ...attrs, rel: "noopener noreferrer", target: "_blank" } }),
    },
    exclusiveFilter: (frame) => {
      const url = frame.tag === "img" ? frame.attribs.src : frame.tag === "a" ? frame.attribs.href : undefined;
      if (url?.startsWith(KNOWLEDGE_FILE_PREFIX)) {
        const match = url.match(/^\/api\/knowledge\/files\/([a-zA-Z0-9_-]+)(?:\?(?:download=1|preview=1))?$/);
        if (!match) return true;
        references.add(match[1]);
      } else if (frame.tag === "img") {
        // Project documents only embed controlled project resources.
        return true;
      } else if (url && !/^(https?:\/\/|mailto:|#)/i.test(url)) {
        return true;
      }
      return false;
    },
  });
  return { content, references: [...references] };
}
