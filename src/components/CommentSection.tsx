"use client";

import { useState, useEffect } from "react";
import RichTextEditor from "./RichTextEditor";
import { Loader2 } from "lucide-react";
import { getTranslations, Locale, localeDateMap } from "@/lib/i18n";
import { getDefaultAvatar } from "@/lib/avatar";

type CommentUser = {
  id: string;
  name: string | null;
  avatar?: string | null;
};

interface Comment {
  id: string;
  content: string;
  createdAt: string;
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
  const translations = getTranslations(locale);

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
        {comments.map((comment) => {
          const avatarUrl = comment.author.avatar || getDefaultAvatar(comment.author.id);
          return (
            <div key={comment.id} className="bg-white border rounded-lg overflow-hidden shadow-sm">
              <div className="bg-slate-50 px-4 py-2 border-b flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-slate-200 flex-shrink-0 flex items-center justify-center font-bold text-xs text-slate-600 shadow-sm border border-slate-300 overflow-hidden">
                    <img src={avatarUrl} alt={comment.author.name} className="w-full h-full object-cover" />
                  </div>
                  <span className="font-semibold text-slate-800">{comment.author.name}</span>
                </div>
                <span className="text-slate-500 text-xs font-medium">{new Date(comment.createdAt).toLocaleString(localeDateMap[locale])}</span>
              </div>
              <div className="p-4">
                <RichTextEditor value={comment.content} onChange={() => {}} readOnly />
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
