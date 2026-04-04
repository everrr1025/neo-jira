import Link from "next/link";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { getActiveProjectIdForUser } from "@/lib/activeProject";
import { redirect } from "next/navigation";
import { getCurrentLocale } from "@/lib/serverLocale";
import { getTranslations } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const locale = await getCurrentLocale();
  const translations = getTranslations(locale);
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const userId = (session.user as any).id as string;
  const userRole = (session.user as any).role as string;
  const isGlobalAdmin = userRole === "ADMIN";
  const activeProjectId = await getActiveProjectIdForUser(userId, userRole);

  const whereClause = isGlobalAdmin
    ? {}
    : { members: { some: { userId } } };

  const projects = await prisma.project.findMany({
    where: whereClause,
    include: {
      owner: true,
      members: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      _count: {
        select: {
          issues: {
            where: { status: { not: "DONE" } },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">{translations.projectsPage.title}</h2>
          <p className="text-sm text-slate-500 mt-1">
            {isGlobalAdmin
              ? translations.projectsPage.adminSubtitle
              : translations.projectsPage.memberSubtitle}
          </p>
        </div>
        {isGlobalAdmin && (
          <Link
            href="/admin"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm"
          >
            {translations.projectsPage.createProject}
          </Link>
        )}
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{translations.projectsPage.project}</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{translations.projectsPage.key}</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{translations.projectsPage.lead}</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{translations.projectsPage.members}</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{translations.projectsPage.openIssues}</th>
              <th scope="col" className="relative px-6 py-3"><span className="sr-only">{translations.projectsPage.actions}</span></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {projects.map((project) => {
              const isSelected = activeProjectId === project.id;
              const canManageSettings =
                isGlobalAdmin || project.members.some((m) => m.userId === userId && m.role === "ADMIN");

              return (
                <tr key={project.id} className={`transition-colors ${isSelected ? "bg-blue-50/40" : "hover:bg-slate-50"}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-8 w-8 rounded bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-sm">
                        {project.key.charAt(0)}
                      </div>
                      <div className="ml-4 flex flex-col">
                        <div className="text-sm font-medium text-slate-900 group-hover:text-blue-600 cursor-pointer">{project.name}</div>
                        <div className="text-xs text-slate-500 truncate max-w-xs">{project.description}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-slate-100 text-slate-800">
                      {project.key}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-900 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold">
                        {project.owner?.name?.charAt(0) || "?"}
                      </div>
                      {project.owner?.name}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-900">
                        {locale === "zh" ? `${project.members.length} 名成员` : `${project.members.length} members`}
                      </span>
                      <div className="flex flex-wrap gap-1 mt-1 max-w-[200px]">
                        {project.members.slice(0, 3).map(m => (
                          <span key={m.userId} title={`${m.user.name || m.user.email} - ${m.role}`} className="w-6 h-6 rounded-full bg-slate-200 border border-white flex items-center justify-center text-[10px] font-bold text-slate-600 cursor-help">
                            {m.user.name?.charAt(0) || m.user.email?.charAt(0) || "?"}
                          </span>
                        ))}
                        {project.members.length > 3 && (
                          <span
                            title={locale === "zh" ? `另外 ${project.members.length - 3} 名成员` : `${project.members.length - 3} more members`}
                            className="w-6 h-6 rounded-full bg-slate-100 border border-white flex items-center justify-center text-[10px] font-bold text-slate-500 cursor-help"
                          >
                            +{project.members.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {project._count.issues}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/projects/select?projectId=${project.id}&from=/`}
                        className={isSelected ? "text-emerald-600 font-semibold" : "text-blue-600 hover:text-blue-900"}
                      >
                        {isSelected ? translations.projectsPage.selected : translations.projectsPage.select}
                      </Link>
                      {canManageSettings && (
                        <Link href={`/projects/${project.id}/settings`} className="text-slate-600 hover:text-slate-900">
                          {translations.projectsPage.settings}
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {projects.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-500 italic">
                  {translations.projectsPage.noProjects}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
