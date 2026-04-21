"use client";

import { useMemo, useState } from "react";

import { updateUserAvatar } from "@/app/actions/user";
import { AVATAR_PRESETS, getDefaultAvatar } from "@/lib/avatar";
import { getTranslations, type Locale } from "@/lib/i18n";

type AvatarPickerProps = {
  userKey: string;
  userName: string;
  locale: Locale;
  initialAvatar?: string | null;
  size?: "sm" | "md" | "lg";
  editable?: boolean;
};

export function AvatarPicker({
  userKey,
  userName,
  locale,
  initialAvatar,
  size = "md",
  editable = true,
}: AvatarPickerProps) {
  const translations = getTranslations(locale);
  const defaultAvatar = useMemo(() => getDefaultAvatar(userKey), [userKey]);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const avatar = selectedAvatar || initialAvatar || defaultAvatar;

  const avatarSize = size === "sm" ? "w-8 h-8" : size === "lg" ? "w-20 h-20" : "w-9 h-9";

  const chooseAvatar = async (avatarUrl: string) => {
    if (!editable) return;
    setSelectedAvatar(avatarUrl);
    setIsOpen(false);
    await updateUserAvatar(userKey, avatarUrl);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (editable) {
            setIsOpen(true);
          }
        }}
        className={`${avatarSize} overflow-hidden rounded-full bg-slate-700 shadow-sm transition-all ${
          editable
            ? "border border-slate-500/40 hover:ring-2 hover:ring-blue-400/60"
            : "border border-slate-200"
        }`}
        title={editable ? translations.sidebar.changeAvatar : userName}
      >
        <img src={avatar} alt={userName} className="h-full w-full object-cover" />
      </button>

      {editable && isOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-md overflow-hidden rounded-xl border bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="font-semibold text-slate-800">{translations.sidebar.chooseAvatar}</h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
              >
                {translations.sidebar.close}
              </button>
            </div>
            <div className="grid grid-cols-4 gap-3 p-4">
              {AVATAR_PRESETS.map((item) => (
                <button
                  type="button"
                  key={item}
                  onClick={() => chooseAvatar(item)}
                  className={`aspect-square overflow-hidden rounded-full border-2 transition-all ${
                    avatar === item
                      ? "border-blue-500 ring-2 ring-blue-200"
                      : "border-slate-200 hover:border-slate-400"
                  }`}
                >
                  <img src={item} alt="avatar option" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
