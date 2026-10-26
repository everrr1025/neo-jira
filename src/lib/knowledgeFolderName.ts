export function knowledgeFolderNameError(name: string, locale: "zh" | "en" = "zh"): string | null {
  const t = (zh: string, en: string) => locale === "zh" ? zh : en;
  if (/[/\\]/.test(name)) return t("文件夹名称不能包含 / 或 \\", "Folder names cannot contain / or \\");
  if (Array.from(name).some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || (code >= 127 && code <= 159);
  })) return t("文件夹名称不能包含换行、制表符等控制字符", "Folder names cannot contain control characters such as newlines or tabs");
  if ([".", ".."].includes(name.trim())) return t("文件夹名称不能仅为 . 或 ..", "Folder names cannot be . or ..");
  return null;
}
