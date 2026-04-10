"use client";

import { useEffect, useMemo, useState } from "react";
import { AVATAR_PRESETS, getDefaultAvatar } from "@/lib/avatar";
import { getTranslations, Locale } from "@/lib/i18n";
import { updateUserAvatar } from "@/app/actions/user";

type AvatarPickerProps = {
  userKey: string;
  userName: string;
  locale: Locale;
  initialAvatar?: string | null;
  size?: "sm" | "md";
};

export function AvatarPicker({ userKey, userName, locale, initialAvatar, size = "md" }: AvatarPickerProps) {
  const translations = getTranslations(locale);
  const defaultAvatar = useMemo(() => getDefaultAvatar(userKey), [userKey]);
  const [avatar, setAvatar] = useState<string>(initialAvatar || defaultAvatar);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (initialAvatar) {
      setAvatar(initialAvatar);
    }
  }, [initialAvatar]);

  const avatarSize = size === "sm" ? "w-8 h-8" : "w-9 h-9";

  const chooseAvatar = async (avatarUrl: string) => {
    setAvatar(avatarUrl);
    setIsOpen(false);
    await updateUserAvatar(userKey, avatarUrl);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`${avatarSize} rounded-full border border-slate-500/40 overflow-hidden bg-slate-700 shadow-sm hover:ring-2 hover:ring-blue-400/60 transition-all`}
        title={translations.sidebar.changeAvatar}
      >
        <img src={avatar} alt={userName} className="w-full h-full object-cover" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl border bg-white shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">{translations.sidebar.chooseAvatar}</h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-xs px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 text-slate-600"
              >
                {translations.sidebar.close}
              </button>
            </div>
            <div className="p-4 grid grid-cols-4 gap-3">
              {AVATAR_PRESETS.map((item) => (
                <button
                  type="button"
                  key={item}
                  onClick={() => chooseAvatar(item)}
                  className={`aspect-square rounded-full overflow-hidden border-2 transition-all ${
                    avatar === item
                      ? "border-blue-500 ring-2 ring-blue-200"
                      : "border-slate-200 hover:border-slate-400"
                  }`}
                >
                  <img src={item} alt="avatar option" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
