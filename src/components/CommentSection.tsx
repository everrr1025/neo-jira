"use client";

import { useState, useEffect } from "react";
import RichTextEditor from "./RichTextEditor";
import { Loader2 } from "lucide-react";
import { getTranslations, Locale, localeDateMap } from "@/lib/i18n";

type CommentUser = {
  id: string;
  name: string | null;
};

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  author: {
    id: string;
    name: string;
    email: string;
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
  const translations = getTranslations(locale);

  const mentionQuery = newComment.match(/(?:\s|^)@([^\s]*)$/)?.[1]?.toLowerCase() || null;

  const filteredUsers = mentionQuery !== null && users
    ? users.filter((user) => user.name?.toLowerCase().includes(mentionQuery) && user.id !== currentUserId)
    : [];

  const handleMentionInsert = (name: string) => {
    const match = newComment.match(/(?:\s|^)@([^\s]*)$/);
    if (match) {
      const index = newComment.lastIndexOf(`@${match[1]}`);
      if (index !== -1) {
        const textBefore = newComment.substring(0, index);
        const textAfter = newComment.substring(index + match[1].length + 1);
        setNewComment(textBefore + `@${name} ` + textAfter);
      }
    }
  };

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
        const created = await res.json();
        setComments([...comments, created]);
        setNewComment("");
      }
    } catch (error) {
      console.error("Failed to post comment", error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="py-4 text-center text-slate-500"><Loader2 className="animate-spin inline mr-2" size={16}/>{translations.commentSection.loading}</div>;
  }

  return (
    <div className="mt-8 border-t pt-8">
      <h3 className="font-bold text-lg text-slate-800 mb-6">{translations.commentSection.title} ({comments.length})</h3>
      
      <div className="space-y-6 mb-8">
        {comments.map((comment) => (
          <div key={comment.id} className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-slate-200 flex-shrink-0 flex items-center justify-center font-bold text-slate-600 shadow-sm border border-slate-300">
              {comment.author.name?.charAt(0) || "U"}
            </div>
            <div className="flex-1 bg-white border rounded-lg overflow-hidden shadow-sm">
              <div className="bg-slate-50 px-4 py-2 border-b flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-800">{comment.author.name}</span>
                <span className="text-slate-500 text-xs font-medium">{new Date(comment.createdAt).toLocaleString(localeDateMap[locale])}</span>
              </div>
              <div className="p-4">
                <RichTextEditor value={comment.content} onChange={() => {}} readOnly />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-4">
        <div className="w-10 h-10 rounded-full bg-blue-100 flex-shrink-0 flex items-center justify-center font-bold text-blue-700 shadow-sm border border-blue-200">
          {translations.commentSection.me}
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <RichTextEditor value={newComment} onChange={(v) => setNewComment(v || "")} height={150} />
          </div>

          {mentionQuery !== null && filteredUsers.length > 0 && (
            <div className="bg-white border border-slate-200 shadow-md rounded-lg max-h-40 overflow-y-auto w-full md:w-64 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 bg-slate-50 border-b border-slate-100">
                {translations.commentSection.mentionSomeone}
              </div>
              {filteredUsers.map(u => (
                <button
                  key={u.id}
                  onClick={() => handleMentionInsert(u.name)}
                  className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center gap-2"
                >
                  <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-bold">
                    {u.name?.charAt(0) || "U"}
                  </div>
                  {u.name}
                </button>
              ))}
            </div>
          )}

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
    </div>
  );
}
