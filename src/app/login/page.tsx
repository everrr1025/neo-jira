import LoginPageClient from "@/components/LoginPageClient";
import { getCurrentLocale } from "@/lib/serverLocale";

export default async function LoginPage() {
  const locale = await getCurrentLocale();
  return <LoginPageClient initialLocale={locale} />;
}
