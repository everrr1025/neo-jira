import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import UserSettingsForm from "@/components/UserSettingsForm";
import { authOptions } from "@/lib/authOptions";
import { getTranslations } from "@/lib/i18n";
import prisma from "@/lib/prisma";
import { getCurrentLocale } from "@/lib/serverLocale";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }

  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    redirect("/login");
  }

  const locale = await getCurrentLocale();
  const translations = getTranslations(locale);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{translations.settingsPage.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{translations.settingsPage.subtitle}</p>
      </div>

      <UserSettingsForm
        user={{
          id: user.id,
          name: user.name || user.email,
          email: user.email,
          avatar: user.avatar,
        }}
        locale={locale}
      />
    </div>
  );
}
