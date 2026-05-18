import LoginPageClient from "@/components/LoginPageClient";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return <LoginPageClient initialErrorCode={params.error === "no-department" ? "no-department" : null} />;
}
