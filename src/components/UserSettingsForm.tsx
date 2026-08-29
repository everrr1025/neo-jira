"use client";

import { type FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Eye, EyeOff, KeyRound, Settings, Shield, UserRound } from "lucide-react";

import AlertPopup from "@/components/AlertPopup";
import { changeUserPassword } from "@/app/actions/user";
import { AvatarPicker } from "@/components/layout/AvatarPicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { getTranslations, type Locale } from "@/lib/i18n";
import { isValidPassword } from "@/lib/validation";

export default function UserSettingsForm({
  user,
  locale,
  passwordChangeRequired = false,
}: {
  user: {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
    isDepartmentAdmin?: boolean;
    departmentPosition?: string | null;
  };
  locale: Locale;
  passwordChangeRequired?: boolean;
}) {
  const translations = getTranslations(locale);
  const text = translations.settingsPage;
  const departmentAdminLabel = locale === "zh" ? "部门管理员" : "Department admin";
  const hasDepartmentMeta = Boolean(user.isDepartmentAdmin || user.departmentPosition);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackType, setFeedbackType] = useState<"error" | "success">("success");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { update: updateSession } = useSession();

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

  const handlePasswordSubmit = (event: FormEvent) => {
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
        if (passwordChangeRequired) {
          await updateSession();
          router.push("/");
          router.refresh();
        }
        return;
      }

      setFeedbackType("error");
      setFeedbackMessage(mapPasswordError(result.error));
    });
  };

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      {passwordChangeRequired ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 lg:col-span-2 dark:text-amber-200">
          {locale === "zh" ? "当前密码为临时密码，请先修改密码后再继续使用系统。" : "Your current password is temporary. Change it before continuing."}
        </div>
      ) : null}
      <Card>
        <CardHeader className="border-b pb-6">
          <div className="flex items-start gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
              <Settings className="size-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-lg">{text.profile}</CardTitle>
              <CardDescription>{text.profileHint}</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <AvatarPicker
              userKey={user.id}
              userName={user.name}
              locale={locale}
              initialAvatar={user.avatar}
              size="lg"
            />
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="truncate text-base font-semibold">{user.name}</div>
                {hasDepartmentMeta ? (
                  <>
                    {user.isDepartmentAdmin ? (
                      <Badge variant="secondary" className="rounded-md">
                        {departmentAdminLabel}
                      </Badge>
                    ) : null}
                    {user.departmentPosition ? (
                      <Badge variant="secondary" className="rounded-md">
                        {user.departmentPosition}
                      </Badge>
                    ) : null}
                  </>
                ) : null}
              </div>
              <div className="truncate text-sm text-muted-foreground">{user.email}</div>
            </div>
          </div>

          <Separator />

          <div className="grid gap-3 text-sm">
            <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
              <UserRound className="size-4 text-muted-foreground" />
              <div className="min-w-0">
                <div className="font-medium">{user.name}</div>
                <div className="truncate text-xs text-muted-foreground">{user.email}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b pb-6">
          <div className="flex items-start gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
              <Shield className="size-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-lg">{text.security}</CardTitle>
              <CardDescription>{text.securityHint}</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handlePasswordSubmit} className="max-w-xl space-y-4">
            <PasswordField
              id="current-password"
              label={text.currentPassword}
              value={currentPassword}
              onChange={setCurrentPassword}
              show={showCurrentPassword}
              onToggleShow={() => setShowCurrentPassword((value) => !value)}
              locale={locale}
            />
            <PasswordField
              id="new-password"
              label={text.newPassword}
              value={newPassword}
              onChange={setNewPassword}
              show={showNewPassword}
              onToggleShow={() => setShowNewPassword((value) => !value)}
              locale={locale}
            />
            <PasswordField
              id="confirm-password"
              label={text.confirmPassword}
              value={confirmPassword}
              onChange={setConfirmPassword}
              show={showConfirmPassword}
              onToggleShow={() => setShowConfirmPassword((value) => !value)}
              locale={locale}
            />

            <div className="flex gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
              <KeyRound className="mt-0.5 size-3.5 shrink-0" />
              <p>{text.passwordRule}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button type="submit" disabled={isPending}>
                {isPending ? text.updatingPassword : text.updatePassword}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

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
  id,
  label,
  value,
  onChange,
  show,
  onToggleShow,
  locale,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggleShow: () => void;
  locale: Locale;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="pr-10"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onToggleShow}
          className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label={show ? (locale === "zh" ? "隐藏密码" : "Hide password") : locale === "zh" ? "显示密码" : "Show password"}
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </Button>
      </div>
    </div>
  );
}
