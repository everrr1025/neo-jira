"use client";

import { useState, useEffect, useRef } from "react";
import RichTextEditor, { type RichTextEditorHandle } from "./RichTextEditor";
import { Loader2, Trash2 } from "lucide-react";
import { getTranslations, Locale, localeDateMap } from "@/lib/i18n";
import { getDefaultAvatar } from "@/lib/avatar";
import { emitIssueActivityUpdated } from "@/lib/issueActivityEvents";

type CommentUser = {
  id: string;
  name: string | null;
  avatar?: string | null;
};

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
  };
}

export default function CommentSection({
  issueId,
  currentUserId,
  users = [],
  locale,
}: {
  issueId: string;
  currentUserId: string;
  users?: CommentUser[];
  locale: Locale;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [savingCommentId, setSavingCommentId] = useState<string | null>(null);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const translations = getTranslations(locale);
  const newCommentEditorRef = useRef<RichTextEditorHandle>(null);
  const editingCommentEditorRef = useRef<RichTextEditorHandle>(null);

  const currentUserAvatar = users.find((u) => u.id === currentUserId)?.avatar || getDefaultAvatar(currentUserId);

  useEffect(() => {
    const fetchComments = async () => {
      try {
        const res = await fetch(`/api/issues/${issueId}/comments`);
        if (res.ok) {
          const data = await res.json();
          setComments(data);
        }
      } catch (error) {
        console.error("Failed to load comments", error);
      } finally {
        setLoading(false);
      }
    };

    void fetchComments();
  }, [issueId]);

  const handleSubmit = async () => {
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/issues/${issueId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment }),
      });
      if (res.ok) {
        newCommentEditorRef.current?.commitPendingUploads();
        const created = await res.json();
        setComments([...comments, created]);
        setNewComment("");
        emitIssueActivityUpdated(issueId);
      }
    } catch (error) {
      console.error("Failed to post comment", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = (comment: Comment) => {
    if (editingCommentId && editingCommentId !== comment.id) {
      void editingCommentEditorRef.current?.discardPendingUploads();
    }

    setEditingCommentId(comment.id);
    setEditingContent(comment.content);
  };

  const handleCancelEdit = async () => {
    await editingCommentEditorRef.current?.discardPendingUploads();
    setEditingCommentId(null);
    setEditingContent("");
    setSavingCommentId(null);
  };

  const handleSaveEdit = async (commentId: string) => {
    if (!editingContent.trim()) {
      return;
    }

    setSavingCommentId(commentId);
    try {
      const res = await fetch(`/api/issues/${issueId}/comments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId, content: editingContent }),
      });

      if (!res.ok) {
        throw new Error("Failed to save comment");
      }

      const updated = (await res.json()) as Comment;
      editingCommentEditorRef.current?.commitPendingUploads();
      setComments((currentComments) =>
        currentComments.map((comment) => (comment.id === updated.id ? updated : comment)),
      );
      setEditingCommentId(null);
      setEditingContent("");
      setSavingCommentId(null);
      emitIssueActivityUpdated(issueId);
    } catch (error) {
      console.error("Failed to update comment", error);
      alert(translations.commentSection.failedToSave);
      setSavingCommentId(null);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm(translations.commentSection.deleteConfirm)) {
      return;
    }

    setDeletingCommentId(commentId);
    try {
      const res = await fetch(`/api/issues/${issueId}/comments`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId }),
      });

      if (!res.ok) {
        throw new Error("Failed to delete comment");
      }

      setComments((currentComments) => currentComments.filter((comment) => comment.id !== commentId));
      emitIssueActivityUpdated(issueId);

      if (editingCommentId === commentId) {
        await handleCancelEdit();
      }
    } catch (error) {
      console.error("Failed to delete comment", error);
      alert(translations.commentSection.failedToDelete);
    } finally {
      setDeletingCommentId(null);
    }
  };

  if (loading) {
    return <div className="py-4 text-center text-slate-500"><Loader2 className="animate-spin inline mr-2" size={16}/>{translations.commentSection.loading}</div>;
  }

  return (
    <div className="mt-8 border-t pt-8">
      <h3 className="font-bold text-lg text-slate-800 mb-6">{translations.commentSection.title} ({comments.length})</h3>
      
      <div className="space-y-6 mb-8">
        {comments.map((comment) => {
          const avatarUrl = comment.author.avatar || getDefaultAvatar(comment.author.id);
          const isAuthor = comment.author.id === currentUserId;
          const isEditing = editingCommentId === comment.id;
          const isEdited = new Date(comment.updatedAt).getTime() > new Date(comment.createdAt).getTime();
          const isSaving = savingCommentId === comment.id;
          const isDeleting = deletingCommentId === comment.id;
          return (
            <div key={comment.id} className="bg-white border rounded-lg overflow-hidden shadow-sm">
              <div className="bg-slate-50 px-4 py-2 border-b flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-slate-200 flex-shrink-0 flex items-center justify-center font-bold text-xs text-slate-600 shadow-sm border border-slate-300 overflow-hidden">
                    <img src={avatarUrl} alt={comment.author.name} className="w-full h-full object-cover" />
                  </div>
                  <span className="font-semibold text-slate-800">{comment.author.name}</span>
                  {isEdited && (
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                      {translations.commentSection.edited}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-500 text-xs font-medium">{new Date(comment.createdAt).toLocaleString(localeDateMap[locale])}</span>
                  {isAuthor && !isEditing && (
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(comment)}
                        className="text-xs font-medium text-blue-600 transition-colors hover:text-blue-800"
                      >
                        {translations.commentSection.editComment}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteComment(comment.id)}
                        disabled={isDeleting}
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-red-600 disabled:opacity-50"
                      >
                        {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                        {translations.commentSection.deleteComment}
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-4">
                {isEditing ? (
                  <div className="space-y-3">
                    <RichTextEditor
                      ref={editingCommentEditorRef}
                      value={editingContent}
                      onChange={(value) => setEditingContent(value || "")}
                      height={150}
                      mentionUsers={users}
                      mentionLabel={translations.commentSection.mentionSomeone}
                      currentUserId={currentUserId}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        disabled={isSaving}
                        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                      >
                        {translations.commentSection.cancelEdit}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(comment.id)}
                        disabled={isSaving || !editingContent.trim()}
                        className="flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                      >
                        {isSaving && <Loader2 size={14} className="animate-spin" />}
                        {translations.commentSection.saveComment}
                      </button>
                    </div>
                  </div>
                ) : (
                  <RichTextEditor value={comment.content} onChange={() => {}} readOnly />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-full bg-blue-100 flex-shrink-0 flex items-center justify-center font-bold text-xs text-blue-700 shadow-sm border border-blue-200 overflow-hidden">
            <img src={currentUserAvatar} alt={translations.commentSection.me} className="w-full h-full object-cover" />
          </div>
          <span className="font-semibold text-sm text-slate-800">{translations.commentSection.me}</span>
        </div>
        <div>
          <RichTextEditor
            ref={newCommentEditorRef}
            value={newComment}
            onChange={(v) => setNewComment(v || "")}
            height={150}
            mentionUsers={users}
            mentionLabel={translations.commentSection.mentionSomeone}
            currentUserId={currentUserId}
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={submitting || !newComment.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-md font-medium text-sm transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            {translations.commentSection.postComment}
          </button>
        </div>
      </div>
    </div>
  );
}
