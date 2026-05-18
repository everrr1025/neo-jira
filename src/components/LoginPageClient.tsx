"use client";

import { signIn, signOut } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
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

const LOGIN_TEXT = {
  subtitle: "\u8BF7\u8F93\u5165\u8D26\u53F7\u4FE1\u606F\u4EE5\u8BBF\u95EE\u4F60\u7684\u5DE5\u4F5C\u533A\u3002",
  emailLabel: "\u90AE\u7BB1\u5730\u5740",
  passwordLabel: "\u5BC6\u7801",
  invalidCredentials: "\u90AE\u7BB1\u6216\u5BC6\u7801\u9519\u8BEF",
  noDepartment: "\u5F53\u524D\u7528\u6237\u4E0D\u5C5E\u4E8E\u4EFB\u4F55\u90E8\u95E8\uFF0C\u8BF7\u8054\u7CFB\u7BA1\u7406\u5458",
  signIn: "\u767B\u5F55",
  signingIn: "\u767B\u5F55\u4E2D...",
  showPassword: "\u663E\u793A\u5BC6\u7801",
  hidePassword: "\u9690\u85CF\u5BC6\u7801",
};

type LoginErrorCode = "invalid-credentials" | "no-department" | null;

const POST_LOGIN_REDIRECT = "/projects/select?projectId=clear&redirectTo=/";

function getLoginErrorCode(error: string): Exclude<LoginErrorCode, null> {
  const normalizedError = error.trim().toUpperCase().replace(/-/g, "_");
  return normalizedError === "NO_DEPARTMENT" ? "no-department" : "invalid-credentials";
}

export default function LoginPageClient({
  initialErrorCode,
}: {
  initialErrorCode?: "no-department" | null;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorCode, setErrorCode] = useState<LoginErrorCode>(initialErrorCode ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const text = LOGIN_TEXT;
  const errorMessage = useMemo(() => {
    if (errorCode === "invalid-credentials") return text.invalidCredentials;
    if (errorCode === "no-department") return text.noDepartment;
    return "";
  }, [errorCode, text.invalidCredentials, text.noDepartment]);

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
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md gap-0 overflow-hidden">
        <CardHeader className="gap-6 border-b pb-6">
          <div className="space-y-2">
            <CardTitle className="text-3xl">{"\u767B\u5F55 SYNC"}</CardTitle>
            <CardDescription>{text.subtitle}</CardDescription>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          {errorMessage && (
            <div className="mb-5 flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive animate-in fade-in duration-200">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span className="font-medium">{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{text.emailLabel}</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@neo-jira.local"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{text.passwordLabel}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                  placeholder="********"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-0.5 top-0.5 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? text.hidePassword : text.showPassword}
                  title={showPassword ? text.hidePassword : text.showPassword}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </Button>
              </div>
            </div>
            <Button
              type="submit"
              disabled={isLoading || !email || !password}
              className="w-full"
            >
              {isLoading && <Loader2 className="animate-spin" />}
              {isLoading ? text.signingIn : text.signIn}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
