"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Languages, Settings, Shield } from "lucide-react";

import AlertPopup from "@/components/AlertPopup";
import { changeUserPassword, updateUserLocale } from "@/app/actions/user";
import { AvatarPicker } from "@/components/layout/AvatarPicker";
import { getTranslations, type Locale } from "@/lib/i18n";
import { isValidPassword } from "@/lib/validation";

export default function UserSettingsForm({
  user,
  locale,
}: {
  user: {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
  };
  locale: Locale;
}) {
  const router = useRouter();
  const translations = getTranslations(locale);
  const text = translations.settingsPage;
  const [currentLocale, setCurrentLocale] = useState<Locale>(locale);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackType, setFeedbackType] = useState<"error" | "success">("success");
  const [isPending, startTransition] = useTransition();

  const switchLocale = (nextLocale: Locale) => {
    if (nextLocale === currentLocale) return;
    startTransition(async () => {
      await updateUserLocale(nextLocale);
      setCurrentLocale(nextLocale);
      router.refresh();
    });
  };

  const mapPasswordError = (error?: string) => {
    switch (error) {
      case "INVALID_CURRENT_PASSWORD":
        return text.incorrectCurrentPassword;
      case "PASSWORD_POLICY_FAILED":
        return text.passwordRule;
      case "PASSWORD_SAME_AS_CURRENT":
        return text.newPasswordMustDiffer;
      case "PASSWORD_NOT_SET":
      case "UNAUTHORIZED":
      default:
        return text.passwordUpdateFailed;
    }
  };

  const handlePasswordSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (newPassword !== confirmPassword) {
      setFeedbackType("error");
      setFeedbackMessage(text.passwordMismatch);
      return;
    }

    if (!isValidPassword(newPassword)) {
      setFeedbackType("error");
      setFeedbackMessage(text.passwordRule);
      return;
    }

    if (currentPassword === newPassword) {
      setFeedbackType("error");
      setFeedbackMessage(text.newPasswordMustDiffer);
      return;
    }

    startTransition(async () => {
      const result = await changeUserPassword(currentPassword, newPassword);

      if (result.success) {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setShowCurrentPassword(false);
        setShowNewPassword(false);
        setShowConfirmPassword(false);
        setFeedbackType("success");
        setFeedbackMessage(text.passwordUpdated);
        return;
      }

      setFeedbackType("error");
      setFeedbackMessage(mapPasswordError(result.error));
    });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-slate-100 p-3 text-slate-600">
            <Settings size={20} />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-slate-900">{text.profile}</h2>
            <p className="mt-1 text-sm text-slate-500">{text.profileHint}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-center">
          <AvatarPicker
            userKey={user.id}
            userName={user.name}
            locale={locale}
            initialAvatar={user.avatar}
            size="lg"
          />
          <div>
            <div className="text-base font-semibold text-slate-900">{user.name}</div>
            <div className="text-sm text-slate-500">{user.email}</div>
            <div className="mt-2 text-xs text-slate-500">{text.avatarHint}</div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
            <Languages size={20} />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-slate-900">{text.language}</h2>
            <p className="mt-1 text-sm text-slate-500">{text.languageHint}</p>
          </div>
        </div>

        <div className="mt-6 inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
          {(["en", "zh"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => switchLocale(option)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                currentLocale === option
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {option === "en" ? text.english : text.chinese}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-amber-50 p-3 text-amber-600">
            <Shield size={20} />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-slate-900">{text.security}</h2>
            <p className="mt-1 text-sm text-slate-500">{text.securityHint}</p>
          </div>
        </div>

        <form onSubmit={handlePasswordSubmit} className="mt-6 max-w-xl space-y-4">
          <PasswordField
            label={text.currentPassword}
            value={currentPassword}
            onChange={setCurrentPassword}
            show={showCurrentPassword}
            onToggleShow={() => setShowCurrentPassword((value) => !value)}
            locale={locale}
          />
          <PasswordField
            label={text.newPassword}
            value={newPassword}
            onChange={setNewPassword}
            show={showNewPassword}
            onToggleShow={() => setShowNewPassword((value) => !value)}
            locale={locale}
          />
          <PasswordField
            label={text.confirmPassword}
            value={confirmPassword}
            onChange={setConfirmPassword}
            show={showConfirmPassword}
            onToggleShow={() => setShowConfirmPassword((value) => !value)}
            locale={locale}
          />

          <p className="text-xs text-slate-500">{text.passwordRule}</p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? text.updatingPassword : text.updatePassword}
            </button>
          </div>
        </form>
      </section>

      <AlertPopup
        message={feedbackMessage}
        type={feedbackType}
        onClose={() => setFeedbackMessage("")}
        autoCloseMs={4000}
      />
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggleShow,
  locale,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggleShow: () => void;
  locale: Locale;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 transition-colors hover:text-slate-600"
          aria-label={show ? (locale === "zh" ? "隐藏密码" : "Hide password") : locale === "zh" ? "显示密码" : "Show password"}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}
