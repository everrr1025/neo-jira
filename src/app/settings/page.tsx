import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import UserSettingsForm from "@/components/UserSettingsForm";
import { authOptions } from "@/lib/authOptions";
import { getUserDepartmentMembership } from "@/lib/departmentAccess";
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

  const [user, departmentMembership] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
      },
    }),
    getUserDepartmentMembership(userId),
  ]);

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{translations.settingsPage.title}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{translations.settingsPage.subtitle}</p>
      </div>

      <UserSettingsForm
        user={{
          id: user.id,
          name: user.name || user.email,
          email: user.email,
          avatar: user.avatar,
          isDepartmentAdmin: departmentMembership?.isDepartmentAdmin || false,
          departmentPosition: departmentMembership?.positionName || null,
        }}
        locale={locale}
      />
    </div>
  );
}
