"use client";

import { signOut } from "next-auth/react";
import { LogOut, MessageSquare, Check, KeyRound, X, Eye, EyeOff } from "lucide-react";
import { useState, useRef, useEffect, useCallback, useTransition } from "react";
import { getTranslations, Locale } from "@/lib/i18n";
import { AvatarPicker } from "./AvatarPicker";
import AlertPopup from "@/components/AlertPopup";
import { changeUserPassword } from "@/app/actions/user";
import { isValidPassword } from "@/lib/validation";

type NotificationItem = {
  id: string;
  type: string;
  message: string;
  link?: string | null;
  read: boolean;
  createdAt: string;
  actor?: { name: string | null } | null;
};

function getDisplayName(notification: NotificationItem) {
  return notification.actor?.name || "System";
}

function getPasswordText(locale: Locale) {
  if (locale === "zh") {
    return {
      changePassword: "修改密码",
      title: "修改密码",
      currentPassword: "当前密码",
      newPassword: "新密码",
      confirmPassword: "确认新密码",
      passwordRule: "至少 8 位，并包含大写/小写/数字/特殊符号中的至少 3 项。",
      cancel: "取消",
      submit: "更新密码",
      submitting: "更新中...",
      passwordChanged: "密码修改成功。",
      passwordMismatch: "两次输入的新密码不一致。",
      incorrectCurrentPassword: "当前密码不正确。",
      newPasswordMustDiffer: "新密码不能与当前密码相同。",
      changePasswordFailed: "修改密码失败。",
    };
  }

  return {
    changePassword: "Change password",
    title: "Change Password",
    currentPassword: "Current password",
    newPassword: "New password",
    confirmPassword: "Confirm password",
    passwordRule: "At least 8 chars, and include at least 3 of uppercase/lowercase/number/special.",
    cancel: "Cancel",
    submit: "Update Password",
    submitting: "Updating...",
    passwordChanged: "Password updated successfully.",
    passwordMismatch: "The new passwords do not match.",
    incorrectCurrentPassword: "The current password is incorrect.",
    newPasswordMustDiffer: "The new password must be different from the current password.",
    changePasswordFailed: "Failed to update password.",
  };
}

export function SidebarUserMenu({
  userId,
  userName,
  userEmail,
  userAvatar,
  locale,
}: {
  userId: string;
  userName: string;
  userEmail: string;
  userAvatar?: string | null;
  locale: Locale;
}) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackType, setFeedbackType] = useState<"error" | "success">("error");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isPending, startTransition] = useTransition();
  const popoverRef = useRef<HTMLDivElement>(null);
  const translations = getTranslations(locale);
  const passwordText = getPasswordText(locale);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as NotificationItem[];
      setNotifications(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (unreadCount === 0) return;
    try {
      const res = await fetch("/api/notifications", { method: "PATCH" });
      if (!res.ok) return;
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (e) {
      console.error(e);
    }
  }, [unreadCount]);

  useEffect(() => {
    void fetchNotifications();
    const interval = setInterval(() => {
      void fetchNotifications();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggleNotifications = () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (nextOpen && unreadCount > 0) {
      void markAllAsRead();
    }
  };

  const resetPasswordForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const closePasswordModal = () => {
    setIsPasswordModalOpen(false);
    resetPasswordForm();
  };

  const mapPasswordError = (error?: string) => {
    switch (error) {
      case "INVALID_CURRENT_PASSWORD":
        return passwordText.incorrectCurrentPassword;
      case "PASSWORD_POLICY_FAILED":
        return passwordText.passwordRule;
      case "PASSWORD_SAME_AS_CURRENT":
        return passwordText.newPasswordMustDiffer;
      case "PASSWORD_NOT_SET":
      case "UNAUTHORIZED":
      default:
        return passwordText.changePasswordFailed;
    }
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setFeedbackType("error");
      setFeedbackMessage(passwordText.passwordMismatch);
      return;
    }

    if (!isValidPassword(newPassword)) {
      setFeedbackType("error");
      setFeedbackMessage(passwordText.passwordRule);
      return;
    }

    if (currentPassword === newPassword) {
      setFeedbackType("error");
      setFeedbackMessage(passwordText.newPasswordMustDiffer);
      return;
    }

    startTransition(async () => {
      const result = await changeUserPassword(currentPassword, newPassword);

      if (result.success) {
        setFeedbackType("success");
        setFeedbackMessage(passwordText.passwordChanged);
        closePasswordModal();
        return;
      }

      setFeedbackType("error");
      setFeedbackMessage(mapPasswordError(result.error));
    });
  };

  return (
    <div className="flex items-center justify-between w-full gap-2">
      <div className="flex items-center gap-3 px-3 py-2 rounded-md min-w-0 flex-1">
        <div className="flex-shrink-0">
          <AvatarPicker userKey={userId} userName={userName} locale={locale} initialAvatar={userAvatar} size="sm" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-white font-medium text-sm truncate" title={userName}>{userName}</span>
          <span className="text-slate-500 text-xs truncate" title={userEmail}>{userEmail}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 relative flex-shrink-0" ref={popoverRef}>
        <button
          onClick={handleToggleNotifications}
          className="p-2 relative rounded-md hover:bg-slate-800 text-slate-500 hover:text-blue-400 transition-colors"
          title={translations.sidebar.messages}
        >
          <MessageSquare size={16} />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-slate-900"></span>
          )}
        </button>

        {isOpen && (
          <div className="absolute bottom-full left-0 mb-2 w-72 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden z-50">
            <div className="p-3 border-b flex justify-between items-center bg-slate-50">
              <span className="font-semibold text-sm text-slate-800">{translations.sidebar.notifications}</span>
              {unreadCount > 0 && (
                <button onClick={() => void markAllAsRead()} className="text-xs text-blue-600 hover:underline">
                  {translations.sidebar.markAllRead}
                </button>
              )}
            </div>
            <div className="max-h-64 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-slate-500">{translations.sidebar.noNotifications}</div>
              ) : (
                notifications.map((n) => {
                  const actorName = getDisplayName(n);
                  const createdAtLabel = new Date(n.createdAt).toLocaleString(locale === "zh" ? "zh-CN" : "en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <a
                      href={n.link || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      key={n.id}
                      onClick={() => setIsOpen(false)}
                      className={`block p-3 border-b border-slate-100 hover:bg-slate-50 transition-colors flex gap-3 ${
                        !n.read ? "bg-blue-50/30" : ""
                      }`}
                    >
                      <div className="mt-0.5">
                        {!n.read ? (
                          <div className="w-2 h-2 mt-1.5 rounded-full bg-blue-500"></div>
                        ) : (
                          <Check size={14} className="mt-0.5 text-slate-300" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm ${!n.read ? "font-medium text-slate-800" : "text-slate-600"}`}>
                          <span className="font-semibold">{actorName}</span> {n.message}
                        </p>
                        <span className="text-xs text-slate-400 mt-1 inline-block">{createdAtLabel}</span>
                      </div>
                    </a>
                  );
                })
              )}
            </div>
          </div>
        )}

        <button
          onClick={() => {
            setIsOpen(false);
            setIsPasswordModalOpen(true);
          }}
          className="p-2 rounded-md hover:bg-slate-800 text-slate-500 hover:text-amber-400 transition-colors"
          title={passwordText.changePassword}
        >
          <KeyRound size={16} />
        </button>

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="p-2 rounded-md hover:bg-slate-800 text-slate-500 hover:text-red-400 transition-colors"
          title={translations.sidebar.signOut}
        >
          <LogOut size={16} />
        </button>
      </div>

      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-800">{passwordText.title}</h2>
              <button
                type="button"
                onClick={closePasswordModal}
                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                aria-label={translations.sidebar.close}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4 px-6 py-5">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">
                  {passwordText.currentPassword}
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((value) => !value)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 transition-colors hover:text-slate-600"
                    aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                  >
                    {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">
                  {passwordText.newPassword}
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((value) => !value)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 transition-colors hover:text-slate-600"
                    aria-label={showNewPassword ? "Hide password" : "Show password"}
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">
                  {passwordText.confirmPassword}
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((value) => !value)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 transition-colors hover:text-slate-600"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-500">{passwordText.passwordRule}</p>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closePasswordModal}
                  disabled={isPending}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  {passwordText.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  {isPending ? passwordText.submitting : passwordText.submit}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AlertPopup
        message={feedbackMessage}
        type={feedbackType}
        onClose={() => setFeedbackMessage("")}
        autoCloseMs={4000}
      />
    </div>
  );
}
