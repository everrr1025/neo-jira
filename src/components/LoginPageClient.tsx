"use client";

import { signIn, signOut } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { LANGUAGE_COOKIE, Locale } from "@/lib/i18n";

const LOGIN_TEXT: Record<
  Locale,
  {
    title: string;
    subtitle: string;
    emailLabel: string;
    passwordLabel: string;
    invalidCredentials: string;
    noDepartment: string;
    signIn: string;
    signingIn: string;
    showPassword: string;
    hidePassword: string;
  }
> = {
  en: {
    title: "Sign in to Neo-Jira",
    subtitle: "Enter your credentials to access your workspace.",
    emailLabel: "Email Address",
    passwordLabel: "Password",
    invalidCredentials: "Invalid email or password",
    noDepartment: "Your account is not assigned to any department. Please contact an administrator.",
    signIn: "Sign In",
    signingIn: "Signing in...",
    showPassword: "Show password",
    hidePassword: "Hide password",
  },
  zh: {
    title: "\u767B\u5F55 Neo-Jira",
    subtitle: "\u8BF7\u8F93\u5165\u8D26\u53F7\u4FE1\u606F\u4EE5\u8BBF\u95EE\u4F60\u7684\u5DE5\u4F5C\u533A\u3002",
    emailLabel: "\u90AE\u7BB1\u5730\u5740",
    passwordLabel: "\u5BC6\u7801",
    invalidCredentials: "\u90AE\u7BB1\u6216\u5BC6\u7801\u9519\u8BEF",
    noDepartment: "\u5F53\u524D\u7528\u6237\u4E0D\u5C5E\u4E8E\u4EFB\u4F55\u90E8\u95E8\uFF0C\u8BF7\u8054\u7CFB\u7BA1\u7406\u5458",
    signIn: "\u767B\u5F55",
    signingIn: "\u767B\u5F55\u4E2D...",
    showPassword: "\u663E\u793A\u5BC6\u7801",
    hidePassword: "\u9690\u85CF\u5BC6\u7801",
  },
};

type LoginErrorCode = "invalid-credentials" | "no-department" | null;

const POST_LOGIN_REDIRECT = "/projects/select?projectId=clear&redirectTo=/";

function getLoginErrorCode(error: string): Exclude<LoginErrorCode, null> {
  const normalizedError = error.trim().toUpperCase().replace(/-/g, "_");
  return normalizedError === "NO_DEPARTMENT" ? "no-department" : "invalid-credentials";
}

export default function LoginPageClient({
  initialLocale,
  initialErrorCode,
}: {
  initialLocale: Locale;
  initialErrorCode?: "no-department" | null;
}) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorCode, setErrorCode] = useState<LoginErrorCode>(initialErrorCode ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const text = LOGIN_TEXT[locale];
  const errorMessage = useMemo(() => {
    if (errorCode === "invalid-credentials") return text.invalidCredentials;
    if (errorCode === "no-department") return text.noDepartment;
    return "";
  }, [errorCode, text.invalidCredentials, text.noDepartment]);

  const switchLocale = useCallback(
    (nextLocale: Locale) => {
      if (nextLocale === locale) return;
      document.cookie = `${LANGUAGE_COOKIE}=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
      setLocale(nextLocale);
    },
    [locale]
  );

  useEffect(() => {
    if (initialErrorCode !== "no-department") return;

    window.history.replaceState(window.history.state, "", window.location.pathname);
    void signOut({ redirect: false });
  }, [initialErrorCode]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorCode(null);

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: POST_LOGIN_REDIRECT,
    });

    if (res?.ok) {
      router.push(POST_LOGIN_REDIRECT);
      router.refresh();
      return;
    }

    if (res?.error) {
      setErrorCode(getLoginErrorCode(res.error));
      setIsLoading(false);
      return;
    }

    setErrorCode("invalid-credentials");
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg shadow-slate-200/50 w-full max-w-md border border-slate-100">
        <div className="mb-6 flex justify-end">
          <div className="inline-flex rounded-full border border-slate-200 bg-white p-1">
            {(["en", "zh"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => switchLocale(option)}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                  locale === option ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {option === "en" ? "EN" : "\u4E2D\u6587"}
              </button>
            ))}
          </div>
        </div>

        <h1 className="text-2xl font-bold text-slate-800 mb-8 flex items-center justify-center gap-3">
          <span className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-inner shadow-blue-700 text-white text-base font-bold italic tracking-tighter">
            NJ
          </span>
          <span>{text.title}</span>
        </h1>

        {errorMessage && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm font-medium mb-6 border border-red-100 text-center animate-in fade-in duration-200">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">{text.emailLabel}</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border-2 border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-0 focus:border-blue-500 transition-colors"
              placeholder="admin@neo-jira.local"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">{text.passwordLabel}</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border-2 border-slate-200 rounded-md px-3 pr-10 py-2 text-sm focus:outline-none focus:ring-0 focus:border-blue-500 transition-colors"
                placeholder="********"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute inset-y-0 right-0 px-3 text-slate-400 hover:text-slate-600 transition-colors"
                aria-label={showPassword ? text.hidePassword : text.showPassword}
                title={showPassword ? text.hidePassword : text.showPassword}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={isLoading || !email || !password}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-md transition-colors shadow-sm disabled:opacity-70 flex justify-center items-center gap-2"
          >
            {isLoading && <Loader2 size={18} className="animate-spin" />}
            {isLoading ? text.signingIn : text.signIn}
          </button>
        </form>
      </div>
    </div>
  );
}
