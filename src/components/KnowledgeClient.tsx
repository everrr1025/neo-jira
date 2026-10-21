"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, File, FileText, Folder, FolderPlus, Trash2, Search, MoreHorizontal, Download, Save, Paperclip, X, Star, Plus, ChevronDown, ChevronRight } from "lucide-react";
import type { KnowledgePageData } from "@/lib/knowledge";
import { saveKnowledgeItem, updateKnowledgeItemMetadata, favoriteKnowledgeItem, changeKnowledgeItem, loadKnowledge, discardKnowledgeUpload } from "@/app/actions/knowledge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import RichTextEditor, { type RichTextEditorHandle } from "@/components/RichTextEditor";
import { composeKnowledgeEditorContent, splitKnowledgeEditorContent } from "@/lib/knowledgeEditor";
import { formatStorageSize } from "@/lib/fileStorage";
import type { Locale } from "@/lib/i18n";

type Item = KnowledgePageData["rows"][number];
type TreeItem = KnowledgePageData["tree"][number];
type Asset = NonNullable<Item["asset"]>;
type Draft = { id?: string; title: string; contentHtml: string; parentId: string | null; version?: number; attachments: Item["attachments"] };
type Options = { folderId: string | null; itemId?: string; search: string; trash: boolean; favorites: boolean; page: number };

export default function KnowledgeClient({ initialData, projectId, basePath, options, locale, uploadLimit }: {
  initialData: KnowledgePageData; projectId: string; basePath: string; options: Options; locale: Locale; uploadLimit: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const t = (zh: string, en: string) => locale === "zh" ? zh : en;
  const [data, setData] = useState(initialData);
  const document = data.current?.type === "DOCUMENT" ? data.current : null;
  const initialDraft = document ? { id: document.id, title: document.title, contentHtml: document.contentHtml, parentId: document.parentId, version: document.version, attachments: document.attachments.filter((a) => a.usage === "ATTACHMENT") } : null;
  const [draft, setDraft] = useState<Draft | null>(initialDraft);
  const [editorContent, setEditorContent] = useState(() => composeKnowledgeEditorContent(initialDraft?.title || t("未命名文档", "Untitled document"), initialDraft?.contentHtml || ""));
  const [saved, setSaved] = useState(JSON.stringify(initialDraft));
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [search, setSearch] = useState(options.search);
  const [modal, setModal] = useState<{ action: "folder" | "rename" | "move" | "delete" | "purge"; item?: TreeItem; parentId?: string | null } | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [foldersReady, setFoldersReady] = useState(false);
  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [picker, setPicker] = useState<KnowledgePageData | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [createTarget, setCreateTarget] = useState<{ type: "FILE" | "DOCUMENT"; folderId?: string } | null>(null);
  const [draftKey, setDraftKey] = useState(0);
  const uploadParent = useRef<string | null | undefined>(undefined);
  const editorRef = useRef<RichTextEditorHandle>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const attachmentInput = useRef<HTMLInputElement>(null);
  const dirty = !!draft && JSON.stringify(draft) !== saved;
  const dirtyRef = useRef(dirty);
  const editable = draft && (!draft.id ? data.access.canCreate : !!data.current?.canEdit);
  const locked = busy || uploading > 0;

  useEffect(() => { dirtyRef.current = dirty; }, [dirty]);
  useEffect(() => {
    const warning = locale === "zh" ? "文档尚未保存，确定离开？" : "Discard unsaved changes?";
    const currentEntry = { state: window.history.state, url: window.location.href };
    const back = (event: PopStateEvent) => {
      if (!dirtyRef.current) return;
      if (!window.confirm(warning)) {
        event.stopImmediatePropagation();
        window.history.pushState(currentEntry.state, "", currentEntry.url);
      } else dirtyRef.current = false;
    };
    const unload = (event: BeforeUnloadEvent) => { if (dirtyRef.current) { event.preventDefault(); event.returnValue = ""; } };
    const click = (event: MouseEvent) => {
      const link = (event.target as Element)?.closest?.("a[href]");
      if (!dirtyRef.current || !link || link.getAttribute("target") === "_blank" || event.ctrlKey || event.metaKey) return;
      if (!window.confirm(warning)) { event.preventDefault(); event.stopPropagation(); }
      else {
        dirtyRef.current = false;
        if ((link as HTMLAnchorElement).href === window.location.href) {
          event.preventDefault();
          window.location.reload();
        }
      }
    };
    window.addEventListener("beforeunload", unload);
    window.addEventListener("popstate", back, true);
    window.document.addEventListener("click", click, true);
    return () => { window.removeEventListener("beforeunload", unload); window.removeEventListener("popstate", back, true); window.document.removeEventListener("click", click, true); };
  }, [locale]);

  const href = (folderId?: string | null, page = 1, query = "", trash = false, favorites = false) => {
    const params = new URLSearchParams();
    if (folderId) params.set("folder", folderId);
    if (query) params.set("search", query);
    if (favorites && !trash) params.set("favorites", "1");
    if (trash) params.set("trash", "1");
    if (page > 1) params.set("page", String(page));
    return `${basePath}${params.size ? `?${params}` : ""}`;
  };
  const navigate = (url: string) => {
    if (dirtyRef.current && !window.confirm(t("文档尚未保存，确定离开？", "Discard unsaved changes?"))) return;
    dirtyRef.current = false;
    router.push(url);
  };
  const pathOf = (parentId: string | null) => {
    const result: KnowledgePageData["tree"] = [];
    const seen = new Set<string>();
    while (parentId && !seen.has(parentId)) {
      seen.add(parentId);
      const parent = data.tree.find((item) => item.id === parentId);
      if (!parent) break;
      result.unshift(parent);
      parentId = parent.parentId;
    }
    return result;
  };
  const folderStorageKey = `knowledge-folders:${data.access.userId}:${projectId}`;
  const activeParent = draft ? draft.parentId : data.current ? data.current.parentId : options.folderId;
  const activePath = JSON.stringify(pathOf(activeParent).map((item) => item.id));
  useEffect(() => {
    let stored: Record<string, boolean> = {};
    try {
      const value: unknown = JSON.parse(localStorage.getItem(folderStorageKey) || "{}");
      if (value && typeof value === "object" && !Array.isArray(value)) {
        stored = Object.fromEntries(Object.entries(value).filter(([, collapsed]) => collapsed === true));
      }
    } catch { /* Storage may be unavailable. */ }
    for (const id of JSON.parse(activePath) as string[]) delete stored[id];
    setCollapsed(stored);
    setFoldersReady(true);
  }, [folderStorageKey, activePath]);
  useEffect(() => {
    if (!foldersReady) return;
    try { localStorage.setItem(folderStorageKey, JSON.stringify(collapsed)); } catch { /* Keep the in-memory preference. */ }
  }, [collapsed, folderStorageKey, foldersReady]);
  const breadcrumbFolders = pathOf(activeParent);
  const visibleBreadcrumbFolders = breadcrumbFolders.length > 2 ? [breadcrumbFolders[0], breadcrumbFolders[breadcrumbFolders.length - 1]] : breadcrumbFolders;
  const fullBreadcrumbPath = [t("知识", "Knowledge"), ...breadcrumbFolders.map((folder) => folder.title), ...(!draft && data.current ? [data.current.title] : !draft && options.trash ? [t("回收站", "Trash")] : !draft && options.favorites ? [t("收藏", "Favorites")] : [])].join(" / ");
  const creationParent = activeParent;
  const isRootView = !draft && !data.current && !options.folderId && !options.search && !options.favorites && !options.trash;
  const chooseCreationParent = !draft && !data.current && (!!options.search || options.favorites);
  const beginCreation = (type: "FILE" | "DOCUMENT", parentId: string | null) => {
    if (type === "FILE") {
      uploadParent.current = parentId;
      fileInput.current?.click();
      return;
    }
    if (dirtyRef.current && !window.confirm(t("文档尚未保存，确定放弃并新建文档？", "Discard unsaved changes and create a new document?"))) return;
    setDraft({ title: t("未命名文档", "Untitled document"), contentHtml: "", parentId, attachments: [] });
    setEditorContent(composeKnowledgeEditorContent(t("未命名文档", "Untitled document"), ""));
    setSaved("null"); setConflict(false); setError("");
    setDraftKey((current) => current + 1);
  };
  const requestCreation = (type: "FILE" | "DOCUMENT") => {
    if (chooseCreationParent) setCreateTarget({ type });
    else beginCreation(type, creationParent);
  };
  const refresh = async () => {
    const result = await loadKnowledge(projectId, options);
    if (result.success) setData(result.value); else setError(result.error);
  };
  const upload = async (file: globalThis.File): Promise<Asset> => {
    if (file.size > uploadLimit) throw new Error(`${t("文件大小上限", "File size limit")}: ${formatStorageSize(uploadLimit)}`);
    setUploading((count) => count + 1);
    try {
      const body = new FormData(); body.append("file", file); body.append("projectId", projectId);
      const response = await fetch("/api/knowledge/files", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || t("上传失败", "Upload failed"));
      return result;
    } finally { setUploading((count) => count - 1); }
  };
  const uploadMany = async (files: FileList | null, attachment: boolean, parentId: string | null = null) => {
    if (!files) return;
    setError(""); setBusy(true);
    const failures: string[] = [];
    try {
      for (const file of Array.from(files)) {
        try {
          const asset = await upload(file);
          if (attachment) setDraft((current) => current ? { ...current, attachments: [...current.attachments, { fileAssetId: asset.id, displayName: asset.fileName, usage: "ATTACHMENT", asset }] } : current);
          else {
            const result = await saveKnowledgeItem({ projectId, type: "FILE", title: file.name, parentId, fileAssetId: asset.id });
            if (!result.success) throw new Error(result.error);
          }
        } catch (error) { failures.push(`${file.name}: ${(error as Error).message}`); }
      }
      if (!attachment) await refresh();
    } finally { setBusy(false); setError(failures.join("\n")); }
  };
  const save = async () => {
    if (!draft) return;
    if (draft.title.length > 200) { setError(t("文档标题不能超过200个字符", "Document title cannot exceed 200 characters")); return; }
    setBusy(true); setError(""); setConflict(false);
    try {
      const result = await saveKnowledgeItem({ projectId, type: "DOCUMENT", ...draft, attachments: draft.attachments.map(({ fileAssetId, displayName }) => ({ fileAssetId, displayName })) });
      if (!result.success) { setError(result.error); setConflict(result.code === "CONFLICT"); return; }
      editorRef.current?.commitPendingUploads(); dirtyRef.current = false;
      const nextDraft = { ...draft, id: result.value.id, version: result.value.version, contentHtml: result.value.contentHtml };
      setDraft(nextDraft);
      setEditorContent(composeKnowledgeEditorContent(nextDraft.title, nextDraft.contentHtml));
      setSaved(JSON.stringify(nextDraft));
      setData((current) => ({ ...current,
        current: current.current ? { ...current.current, title: nextDraft.title, contentHtml: nextDraft.contentHtml, version: nextDraft.version, attachments: [...current.current.attachments.filter((attachment) => attachment.usage === "INLINE"), ...nextDraft.attachments] } : null,
        tree: current.tree.map((item) => item.id === nextDraft.id ? { ...item, title: nextDraft.title, version: result.value.version } : item),
      }));
      router.push(`${basePath}/${result.value.id}`); router.refresh();
    } catch { setError(t("保存失败，请重试", "Save failed; retry")); }
    finally { setBusy(false); }
  };
  const openModal = (action: NonNullable<typeof modal>["action"], item?: TreeItem, parentId: string | null = null) => {
    setModal({ action, item, parentId }); setName(action === "purge" || action === "folder" ? "" : item?.title || ""); setDestination(item?.parentId || ""); setError("");
  };
  const toggleFavorite = async (item: TreeItem) => {
    setBusy(true); setError("");
    try {
      const result = await favoriteKnowledgeItem(projectId, item.id, !item.isFavorite);
      if (!result.success) { setError(result.error); return; }
      await refresh();
    } catch { setError(t("操作失败，请重试", "Operation failed; retry")); }
    finally { setBusy(false); }
  };
  const mutate = async (action: "DELETE" | "RESTORE" | "PURGE", item: TreeItem, confirmTitle?: string) => {
    const affectsCurrent = data.current?.id === item.id || pathOf(draft?.parentId ?? activeParent).some((parent) => parent.id === item.id);
    if (action === "DELETE" && affectsCurrent && dirtyRef.current && !window.confirm(t("文档尚未保存，确定离开？", "Discard unsaved changes?"))) return;
    setBusy(true); setError("");
    try {
      const result = await changeKnowledgeItem({ projectId, id: item.id, version: item.version, action, confirmTitle });
      if (!result.success) { setError(result.error); return; }
      setModal(null);
      if (affectsCurrent && action === "DELETE") { dirtyRef.current = false; router.push(href(item.parentId)); router.refresh(); } else await refresh();
    } catch { setError(t("操作失败，请重试", "Operation failed; retry")); }
    finally { setBusy(false); }
  };
  const submitModal = async () => {
    if (!modal) return;
    if (modal.action === "delete" || modal.action === "purge") { await mutate(modal.action === "delete" ? "DELETE" : "PURGE", modal.item!, name); return; }
    const item = modal.item;
    setBusy(true); setError("");
    try {
      const result = item
        ? await updateKnowledgeItemMetadata({ projectId, id: item.id, version: draft?.id === item.id ? draft.version! : item.version, action: modal.action === "move" ? "MOVE" : "RENAME", ...(modal.action === "move" ? { parentId: destination || null } : { title: name }) })
        : await saveKnowledgeItem({ projectId, type: "FOLDER", title: name, parentId: modal.parentId ?? null });
      if (!result.success) { setError(result.error); return; }
      if (item && draft?.id === item.id) {
        const metadata = { version: result.value.version, ...(modal.action === "move" ? { parentId: destination || null } : { title: name.trim() }) };
        setDraft({ ...draft, ...metadata });
        if (modal.action === "rename") setEditorContent(composeKnowledgeEditorContent(name.trim(), draft.contentHtml));
        setSaved((current) => JSON.stringify({ ...JSON.parse(current), ...metadata }));
      }
      if (!item && modal.parentId) setCollapsed((current) => ({ ...current, [modal.parentId!]: false }));
      setModal(null); await refresh();
    } catch { setError(t("操作失败，请重试", "Operation failed; retry")); }
    finally { setBusy(false); }
  };
  const loadPicker = async (page = 1) => {
    // Search uses a nonempty query only when supplied. A root query alone would
    // miss files nested under folders, so the dedicated file picker is separate.
    setPickerOpen(true); setBusy(true);
    try {
      const result = await loadKnowledge(projectId, { search: pickerSearch, page, filesOnly: true });
      if (result.success) setPicker(result.value); else setError(result.error);
    } catch { setError(t("读取文件失败，请重试", "Unable to load files; retry")); }
    finally { setBusy(false); }
  };
  const actions = (item: TreeItem, sidebar = false) => <div className={`flex shrink-0 items-center ${sidebar ? "opacity-0 transition-opacity group-hover/item:opacity-100 group-focus-within/item:opacity-100 has-[[data-state=open]]:opacity-100 [@media(hover:none)]:opacity-100" : ""}`}>
    {(!options.trash || sidebar) ? <Button variant="ghost" size="icon-xs" disabled={locked} aria-label={`${item.isFavorite ? t("取消收藏", "Unfavorite") : t("收藏", "Favorite")}: ${item.title}`} title={item.isFavorite ? t("取消收藏", "Unfavorite") : t("收藏", "Favorite")} onClick={() => void toggleFavorite(item)}><Star className={item.isFavorite ? "fill-amber-400 text-amber-500" : ""} /></Button> : null}
    {item.canEdit || (item.type === "FOLDER" && data.access.canCreate && !options.trash) ? <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon-xs" aria-label={`${t("操作", "Actions")}: ${item.title}`} disabled={locked}><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
      {options.trash && !sidebar ? <><DropdownMenuItem onSelect={() => void mutate("RESTORE", item)}>{t("恢复", "Restore")}</DropdownMenuItem>{data.access.canManage ? <DropdownMenuItem className="text-destructive" onSelect={() => openModal("purge", item)}>{t("永久删除", "Delete permanently")}</DropdownMenuItem> : null}</> : <>
        {item.type === "FOLDER" && data.access.canCreate ? <DropdownMenuItem onSelect={() => openModal("folder", undefined, item.id)}>{t("新建子文件夹", "New subfolder")}</DropdownMenuItem> : null}
        {item.canEdit ? <><DropdownMenuItem onSelect={() => openModal("rename", item)}>{t("重命名", "Rename")}</DropdownMenuItem><DropdownMenuItem onSelect={() => openModal("move", item)}>{t("移动", "Move")}</DropdownMenuItem><DropdownMenuItem className="text-destructive" onSelect={() => openModal("delete", item)}>{t("移到回收站", "Move to trash")}</DropdownMenuItem></> : null}
      </>}
    </DropdownMenuContent></DropdownMenu> : null}
  </div>;
  const treeNodes = (parentId: string | null, depth = 0): React.ReactNode => data.tree.filter((item) => item.parentId === parentId).map((item) => (
    <div key={item.id}>
      <div className={`group/item flex min-w-0 items-center rounded-md hover:bg-muted ${item.id === options.folderId || item.id === options.itemId ? "bg-muted font-medium" : "text-muted-foreground"}`} style={{ paddingLeft: `${depth * 14}px` }}>
        {item.type === "FOLDER" ? <button type="button" disabled={!foldersReady} className="flex h-9 w-5 shrink-0 items-center justify-center" aria-label={`${collapsed[item.id] ? t("展开", "Expand") : t("收起", "Collapse")}: ${item.title}`} aria-expanded={!collapsed[item.id]} onClick={() => setCollapsed((current) => ({ ...current, [item.id]: !current[item.id] }))}>{collapsed[item.id] ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}</button> : <span className="w-5 shrink-0" />}
        <Link href={item.type === "FOLDER" ? href(item.id) : `${basePath}/${item.id}`} className="flex min-w-0 flex-1 items-center gap-1.5 py-2 text-sm" title={item.title} aria-current={item.id === options.folderId || item.id === options.itemId ? "page" : undefined}>
          {item.type === "FOLDER" ? <Folder className="size-4 shrink-0" /> : item.type === "FILE" ? <File className="size-4 shrink-0" /> : <FileText className="size-4 shrink-0" />}<span className="truncate">{item.title}</span>
          {item.isFavorite ? <Star className="size-3 shrink-0 fill-amber-400 text-amber-500" /> : null}
        </Link>
        {actions(item, true)}
      </div>
      {item.type === "FOLDER" && !collapsed[item.id] ? treeNodes(item.id, depth + 1) : null}
    </div>
  ));
  const icon = (type: string) => type === "FOLDER" ? <Folder className="size-4 text-amber-600" /> : type === "DOCUMENT" ? <FileText className="size-4 text-blue-600" /> : <File className="size-4 text-muted-foreground" />;

  return <div className={`flex min-h-0 flex-col gap-4 ${pathname.startsWith("/knowledge") ? "md:h-[calc(100dvh-7rem)]" : "md:h-[calc(100dvh-3rem)]"}`}>
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <h1 className="flex shrink-0 items-center gap-2 text-xl font-semibold"><BookOpen className="size-5" />{t("知识", "Knowledge")}</h1>
        {!isRootView ? <nav aria-label={t("面包屑", "Breadcrumbs")} title={fullBreadcrumbPath} className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          <Link href={basePath} aria-label={t("根目录", "Root")} className="shrink-0">/</Link>
          {visibleBreadcrumbFolders.map((folder, index) => <span key={folder.id} className="flex min-w-0 items-center gap-2">
            {index === 1 && breadcrumbFolders.length > 2 ? <><DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="rounded px-1 hover:bg-muted" aria-label={t("展开中间路径", "Show intermediate folders")}>…</button></DropdownMenuTrigger><DropdownMenuContent>{breadcrumbFolders.slice(1, -1).map((parent) => <DropdownMenuItem key={parent.id} onSelect={() => navigate(href(parent.id))}>{parent.title}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu><span>/</span></> : null}
            <Link href={href(folder.id)} className="max-w-32 truncate hover:text-foreground" title={folder.title}>{folder.title}</Link>
            {index < visibleBreadcrumbFolders.length - 1 ? <span>/</span> : null}
          </span>)}
          {!draft && data.current ? <span className="min-w-0 max-w-48 truncate font-medium text-foreground" title={data.current.title} aria-current="page">{breadcrumbFolders.length ? "/ " : ""}{data.current.title}</span> : null}
          {!draft && !data.current && (options.trash || options.favorites) ? <span className="shrink-0">{options.trash ? t("回收站", "Trash") : t("收藏", "Favorites")}</span> : null}
        </nav> : null}
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
        <form className="flex w-full min-w-0 flex-none gap-1 sm:w-72 sm:flex-1" onSubmit={(event) => { event.preventDefault(); navigate(href(null, 1, search, options.trash, options.favorites)); }}>
          <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label={t("搜索知识", "Search knowledge")} placeholder={options.trash ? t("搜索回收站标题或文件名", "Search trash titles or filenames") : options.favorites ? t("搜索收藏标题或文件名", "Search favorite titles or filenames") : t("搜索当前项目标题或文件名", "Search project titles or filenames")} className="pl-9 pr-8" value={search} onChange={(event) => setSearch(event.target.value)} />{search ? <button type="button" aria-label={t("清除搜索", "Clear search")} className="absolute right-1 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md hover:bg-muted" onClick={() => { setSearch(""); if (options.search) navigate(href(null, 1, "", options.trash, options.favorites)); }}><X className="size-4" /></button> : null}</div>
        </form>
        {data.access.canCreate && !options.trash ? <>
          <Button className="md:hidden" variant="outline" disabled={locked} onClick={() => openModal("folder")}><FolderPlus />{t("新建文件夹", "New folder")}</Button>
          <Button type="button" disabled={locked} onClick={() => requestCreation("FILE")}><Plus size={16} />{t("文件", "File")}</Button>
          <Button type="button" disabled={locked} onClick={() => requestCreation("DOCUMENT")}><Plus size={16} />{t("文档", "Document")}</Button>
        </> : null}
        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground md:hidden"><Link href={href(null, 1, "", false, true)}>{t("收藏", "Favorites")}</Link><Link href={href(null, 1, "", true)}>{t("回收站", "Trash")}</Link></div>
      </div>
    </div>
    <input ref={fileInput} className="hidden" type="file" multiple onChange={(event) => { const parentId = uploadParent.current === undefined ? creationParent : uploadParent.current; uploadParent.current = undefined; void uploadMany(event.target.files, false, parentId); event.target.value = ""; }} />
    <input ref={attachmentInput} className="hidden" type="file" multiple onChange={(event) => { void uploadMany(event.target.files, true); event.target.value = ""; }} />
    {error ? <p role="alert" className="whitespace-pre-wrap rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}
    {locked ? <p role="status" className="text-sm text-muted-foreground">{uploading ? t("正在上传…", "Uploading…") : t("处理中…", "Working…")}</p> : null}
    <div className="grid min-h-0 flex-1 overflow-hidden rounded-lg border bg-card md:grid-cols-[260px_minmax(0,1fr)]">
      <aside aria-label={t("知识目录", "Knowledge navigation")} className="hidden min-h-0 min-w-0 flex-col border-r bg-muted/30 p-2 md:flex">
        <Link className={`mb-2 flex items-center gap-2 rounded-md p-2 text-sm hover:bg-muted ${options.favorites && !options.trash ? "bg-muted font-medium" : "text-muted-foreground"}`} href={href(null, 1, "", false, true)}><Star className="size-4" />{t("收藏", "Favorites")}<span className="ml-auto text-xs">{data.tree.filter((item) => item.isFavorite).length}</span></Link>
        <div className="mb-1 flex items-center justify-between border-t px-2 pt-2"><h2 className="text-xs font-medium text-muted-foreground">{t("文件夹", "Folders")}</h2>{data.access.canCreate && !options.trash ? <Button variant="ghost" size="icon-xs" disabled={locked} aria-label={t("新建文件夹", "New folder")} title={t("新建文件夹", "New folder")} onClick={() => openModal("folder")}><Plus /></Button> : null}</div>
        <Link className={`mb-1 flex items-center rounded-md p-2 font-mono text-sm hover:bg-muted ${!options.folderId && !options.itemId && !options.favorites && !options.trash && !options.search ? "bg-muted font-medium" : "text-muted-foreground"}`} href={basePath} aria-label={t("根目录", "Root")} title={t("根目录", "Root")}>/</Link>
        <div className="min-h-0 flex-1 overflow-auto">{treeNodes(null)}</div>
        <Link className="mt-3 flex items-center gap-2 border-t px-2 pt-3 text-sm text-muted-foreground" href={href(null, 1, "", true)}><Trash2 className="size-4" />{t("回收站", "Trash")}</Link>
      </aside>
      <main className={`min-h-0 min-w-0 bg-card ${draft ? "flex flex-col overflow-hidden" : `overflow-auto p-4 ${data.current?.type === "FILE" ? "flex flex-col pb-2" : ""}`}`}>
        {data.current && (!draft || draft.id) ? <div className="mb-3 flex justify-end md:hidden">{actions(data.current)}</div> : null}
        {draft ? <div className="flex min-h-0 flex-1 flex-col">
          {!editable ? <div className="flex shrink-0 items-center justify-end gap-2 px-3 py-2 text-xs text-muted-foreground"><span role="status">{t("已保存", "Saved")}</span><span>{t("只读 · 作者和管理员可编辑", "Read only · author and administrators can edit")}</span></div> : null}
          {conflict ? <div className="flex shrink-0 flex-wrap gap-2 p-3"><Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(`${draft.title}\n${draft.contentHtml}`); } catch { setError(t("复制失败，请手动选择正文复制", "Copy failed; select and copy the content manually")); } }}>{t("复制当前内容", "Copy current content")}</Button><Button variant="outline" onClick={() => { if (window.confirm(t("重新加载将丢弃当前未保存内容，继续？", "Reload and discard unsaved content?"))) { dirtyRef.current = false; window.location.reload(); } }}>{t("重新加载", "Reload")}</Button></div> : null}
          <div inert={busy} className="h-[480px] flex-none overflow-auto md:h-auto md:min-h-0 md:flex-1">
          <RichTextEditor key={draftKey} ref={editorRef} value={editorContent} onChange={(content) => { setEditorContent(content); const fields = splitKnowledgeEditorContent(content, t("未命名文档", "Untitled document")); setDraft((current) => current ? { ...current, ...fields } : current); }} readOnly={!editable} height={560} borderless
            toolbarRight={<div className="flex min-w-0 items-center gap-2"><span role="status" className="text-xs text-muted-foreground">{dirty ? t("未保存", "Unsaved") : t("已保存", "Saved")}</span><Button variant="ghost" size="icon-sm" disabled={locked || !draft.title.trim()} aria-label={t("保存文档", "Save document")} title={t("保存文档", "Save document")} onMouseDown={(event) => event.preventDefault()} onClick={() => void save()}><Save /></Button></div>}
            onUploadImage={async (file) => { try { const asset = await upload(file); if (!asset.mimeType?.startsWith("image/")) { await discardKnowledgeUpload(projectId, asset.id); throw new Error(t("仅支持 PNG、JPEG、GIF、WebP 图片", "Only PNG, JPEG, GIF and WebP images are supported")); } return asset.fileUrl; } catch (error) { setError((error as Error).message); return null; } }}
            onDiscardUpload={async (url) => { await discardKnowledgeUpload(projectId, url.split("/").pop()!); }} />
          </div>
          <div className="max-h-48 shrink-0 space-y-2 overflow-auto border-t px-4 py-3">
            <div className="flex flex-wrap items-center gap-2"><h2 className="mr-auto text-sm font-medium">{t("附件", "Attachments")}</h2>{editable ? <><Button variant="outline" size="sm" disabled={locked} onClick={() => attachmentInput.current?.click()}><Paperclip />{t("上传附件", "Upload attachment")}</Button><Button variant="outline" size="sm" disabled={locked} onClick={() => void loadPicker()}>{t("引用已有文件", "Link existing file")}</Button></> : null}</div>
            {draft.attachments.map((attachment) => <div key={attachment.fileAssetId} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"><File className="size-4 shrink-0" /><a className="min-w-0 flex-1 truncate hover:underline" href={attachment.asset.fileUrl} target="_blank" rel="noreferrer">{attachment.displayName}</a><span className="text-xs text-muted-foreground">{formatStorageSize(attachment.asset.fileSize)}</span><a aria-label={`${t("下载", "Download")} ${attachment.displayName}`} href={`${attachment.asset.fileUrl}?download=1`} target="_blank" rel="noreferrer"><Download className="size-4" /></a>{editable ? <Button variant="ghost" size="icon-xs" disabled={locked} aria-label={`${t("移除附件", "Remove attachment")} ${attachment.displayName}`} onClick={() => setDraft({ ...draft, attachments: draft.attachments.filter((a) => a.fileAssetId !== attachment.fileAssetId) })}><X /></Button> : null}</div>)}
            {!draft.attachments.length ? <p className="py-3 text-sm text-muted-foreground">{t("暂无附件", "No attachments")}</p> : null}
          </div>
        </div> : data.current?.type === "FILE" && data.current.asset ? <div className="flex min-h-0 flex-1 flex-col gap-1">
          <div className={`min-h-0 flex-1 overflow-auto ${data.current.asset.mimeType === "application/pdf" ? "flex flex-col" : ""}`}>{data.current.asset.mimeType?.startsWith("image/") ? <Image unoptimized src={data.current.asset.fileUrl} alt={data.current.title} width={1000} height={700} className="max-h-[65vh] w-auto max-w-full object-contain" /> : data.current.asset.mimeType === "application/pdf" ? <iframe title={data.current.title} src={data.current.asset.fileUrl} className="h-[65vh] w-full shrink-0 rounded-md border md:h-auto md:min-h-0 md:flex-1" /> : <p className="py-16 text-center text-muted-foreground">{t("此文件类型请下载后查看", "Download this file to view it")}</p>}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-x-4 gap-y-1 text-xs text-muted-foreground"><span title={t("更新人", "Updated by")}>{data.current.updaterName}</span><span title={t("文件大小", "File size")}>{formatStorageSize(data.current.asset.fileSize)}</span><Button asChild variant="ghost" size="icon-xs"><a href={`${data.current.asset.fileUrl}?download=1`} target="_blank" rel="noreferrer" aria-label={t("下载", "Download")} title={t("下载", "Download")}><Download className="size-4" /></a></Button></div>
        </div> : <>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b text-muted-foreground"><tr><th className="py-3">{t("名称", "Name")}</th><th>{t("文件大小", "File size")}</th><th>{t("更新人", "Updated by")}</th><th>{t("更新时间", "Updated")}</th><th className="w-20"><span className="sr-only">{t("操作", "Actions")}</span></th></tr></thead><tbody className="divide-y">
            {data.rows.map((item) => <tr key={item.id} className="hover:bg-muted/40"><td className="max-w-sm py-3 pr-3"><div className="flex items-center gap-2">{icon(item.type)}{options.trash ? <span className="truncate">{item.title}</span> : <Link className="truncate hover:underline" href={item.type === "FOLDER" ? href(item.id) : `${basePath}/${item.id}`}>{item.title}</Link>}</div>{options.search || options.favorites ? <div className="mt-1 text-xs text-muted-foreground">{pathOf(item.parentId).map((p) => p.title).join(" / ") || t("根目录", "Root")}</div> : null}</td><td className="whitespace-nowrap pr-4 text-muted-foreground">{item.type === "FILE" && item.asset ? formatStorageSize(item.asset.fileSize) : ""}</td><td className="whitespace-nowrap pr-4 text-muted-foreground">{item.updaterName}</td><td className="whitespace-nowrap pr-4 text-muted-foreground">{new Date(item.updatedAt).toLocaleString(locale === "zh" ? "zh-CN" : "en-US", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })}</td><td>
              {actions(item)}
            </td></tr>)}
          </tbody></table></div>
          {!data.rows.length ? <p className="py-16 text-center text-muted-foreground">{t("暂无内容", "No content")}</p> : null}
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground"><span>{data.total} {t("项", "items")} · {data.page} / {Math.ceil(data.total / 20) || 1}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={data.page <= 1} onClick={() => navigate(href(options.folderId, data.page - 1, options.search, options.trash, options.favorites))}>{t("上一页", "Previous")}</Button><Button variant="outline" size="sm" disabled={data.page * 20 >= data.total} onClick={() => navigate(href(options.folderId, data.page + 1, options.search, options.trash, options.favorites))}>{t("下一页", "Next")}</Button></div></div>
        </>}
      </main>
    </div>
    <Dialog open={!!createTarget} onOpenChange={(open) => { if (!open) setCreateTarget(null); }}><DialogContent><DialogHeader><DialogTitle>{t("选择保存位置", "Choose save location")}</DialogTitle></DialogHeader>
      <select aria-label={t("保存位置", "Save location")} value={createTarget?.folderId ?? "__select__"} onChange={(event) => setCreateTarget((current) => current ? { ...current, folderId: event.target.value } : current)} className="h-10 w-full rounded-md border bg-background px-3">
        <option value="__select__" disabled>{t("请选择文件夹", "Choose a folder")}</option>
        <option value="">{t("根目录", "Root")}</option>
        {data.tree.filter((item) => item.type === "FOLDER").map((item) => <option key={item.id} value={item.id}>{pathOf(item.id).map((folder) => folder.title).join(" / ")}</option>)}
      </select>
      <DialogFooter><Button variant="outline" onClick={() => setCreateTarget(null)}>{t("取消", "Cancel")}</Button><Button disabled={locked || createTarget?.folderId === undefined} onClick={() => { if (!createTarget || createTarget.folderId === undefined) return; setCreateTarget(null); beginCreation(createTarget.type, createTarget.folderId || null); }}>{t("继续", "Continue")}</Button></DialogFooter>
    </DialogContent></Dialog>
    <Dialog open={!!modal} onOpenChange={(open) => { if (!open && !locked) setModal(null); }}><DialogContent><DialogHeader><DialogTitle>{modal?.action === "folder" ? t("新建文件夹", "New folder") : modal?.action === "rename" ? t("重命名", "Rename") : modal?.action === "move" ? t("移动到", "Move to") : modal?.action === "purge" ? t("永久删除", "Delete permanently") : t("移到回收站", "Move to trash")}</DialogTitle></DialogHeader>
      {modal?.action === "folder" ? <p className="text-sm text-muted-foreground">{t("创建位置", "Location")}: {pathOf(modal.parentId ?? null).map((item) => item.title).join(" / ") || t("根目录", "Root")}</p> : null}
      {modal?.action === "move" ? <select aria-label={t("目标文件夹", "Destination folder")} value={destination} onChange={(event) => setDestination(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3"><option value="">{t("根目录", "Root")}</option>{data.tree.filter((item) => item.type === "FOLDER" && item.id !== modal.item?.id && !pathOf(item.id).some((parent) => parent.id === modal.item?.id)).map((item) => <option key={item.id} value={item.id}>{pathOf(item.id).map((p) => p.title).join(" / ")}</option>)}</select> : modal?.action === "delete" ? <p className="text-sm">{t("内容将移至回收站，文件夹中的有效内容也会一起移入，可恢复。", "Move this item and its active descendants to trash? They can be restored.")}</p> : <><p className="text-sm text-muted-foreground">{modal?.action === "purge" ? `${t("输入名称确认永久删除（包含子目录内容）", "Type the name to permanently delete this item and descendants")}: ${modal.item?.title}` : t("名称", "Name")}</p><Input aria-label={t("名称", "Name")} value={name} maxLength={200} onChange={(event) => setName(event.target.value)} /></>}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <DialogFooter><Button variant="outline" disabled={locked} onClick={() => setModal(null)}>{t("取消", "Cancel")}</Button><Button disabled={locked || ((modal?.action === "folder" || modal?.action === "rename") && !name.trim()) || (modal?.action === "purge" && name !== modal.item?.title)} onClick={() => void submitModal()}>{t("确认", "Confirm")}</Button></DialogFooter>
    </DialogContent></Dialog>
    <Dialog open={pickerOpen} onOpenChange={setPickerOpen}><DialogContent><DialogHeader><DialogTitle>{t("引用同项目文件", "Link a project file")}</DialogTitle></DialogHeader><form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void loadPicker(); }}><Input aria-label={t("搜索文件", "Search files")} value={pickerSearch} onChange={(event) => setPickerSearch(event.target.value)} /><Button type="submit" variant="outline" disabled={busy}>{t("搜索", "Search")}</Button></form><div className="max-h-80 space-y-1 overflow-auto">{picker?.rows.map((item) => item.asset ? <Button key={item.id} variant="ghost" className="w-full justify-start" disabled={draft?.attachments.some((a) => a.fileAssetId === item.asset!.id)} onClick={() => { const asset = item.asset!; setDraft((current) => current ? { ...current, attachments: [...current.attachments, { fileAssetId: asset.id, displayName: item.title, usage: "ATTACHMENT", asset }] } : current); setPickerOpen(false); }}>{item.title}</Button> : null)}{picker?.total === 0 ? <p className="py-4 text-sm text-muted-foreground">{t("暂无可引用文件", "No files available")}</p> : null}</div><DialogFooter><Button variant="outline" disabled={busy || !picker || picker.page <= 1} onClick={() => void loadPicker(picker!.page - 1)}>{t("上一页", "Previous")}</Button><Button variant="outline" disabled={busy || !picker || picker.page * 20 >= picker.total} onClick={() => void loadPicker(picker!.page + 1)}>{t("下一页", "Next")}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
