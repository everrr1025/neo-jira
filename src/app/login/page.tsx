import LoginPageClient from "@/components/LoginPageClient";
import { getCurrentLocale } from "@/lib/serverLocale";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const locale = await getCurrentLocale();
  const params = await searchParams;
  return <LoginPageClient initialLocale={locale} initialErrorCode={params.error === "no-department" ? "no-department" : null} />;
}
