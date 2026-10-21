export function composeKnowledgeEditorContent(title: string, contentHtml: string) {
  const escapedTitle = title.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
  return `<h1>${escapedTitle}</h1>${contentHtml || "<p></p>"}`;
}

export function splitKnowledgeEditorContent(editorHtml: string, fallbackTitle: string) {
  const document = new DOMParser().parseFromString(editorHtml, "text/html");
  const titleBlock = document.body.firstElementChild;
  const title = titleBlock?.textContent?.trim() || fallbackTitle;
  titleBlock?.remove();
  return { title, contentHtml: document.body.innerHTML.trim() };
}
