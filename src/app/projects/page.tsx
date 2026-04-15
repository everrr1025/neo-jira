import Link from "next/link";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { getActiveProjectIdForUser } from "@/lib/activeProject";
import { redirect } from "next/navigation";
import { getCurrentLocale } from "@/lib/serverLocale";
import { getTranslations } from "@/lib/i18n";
import { getDefaultAvatar } from "@/lib/avatar";

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

  const whereClause = isGlobalAdmin ? {} : { members: { some: { userId } } };

  const projects = await prisma.project.findMany({
    where: whereClause,
    include: {
      owner: true,
      members: {
        where: { user: { role: { not: "ADMIN" } } },
        include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
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
            {isGlobalAdmin ? translations.projectsPage.adminSubtitle : translations.projectsPage.memberSubtitle}
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
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
              >
                {translations.projectsPage.project}
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
              >
                {translations.projectsPage.key}
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
              >
                {translations.projectsPage.lead}
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
              >
                {translations.projectsPage.members}
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
              >
                {translations.projectsPage.openIssues}
              </th>
              <th scope="col" className="relative px-6 py-3">
                <span className="sr-only">{translations.projectsPage.actions}</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {projects.map((project) => {
              const isSelected = activeProjectId === project.id;
              const canManageSettings =
                isGlobalAdmin || project.members.some((m) => m.userId === userId && m.role === "ADMIN");
              const leadUser = project.owner;
              const leadName = leadUser?.name || leadUser?.email || "?";
              const visibleMembers = project.members.slice(0, 5);
              const hiddenMembers = project.members.slice(5);

              return (
                <tr
                  key={project.id}
                  className={`transition-colors ${isSelected ? "bg-blue-50/40" : "hover:bg-slate-50"}`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-600 font-bold text-white shadow shadow-blue-500/50">
                        {project.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="ml-4 flex flex-col">
                        <div className="text-sm font-medium text-slate-900 group-hover:text-blue-600 cursor-pointer">
                          {project.name}
                        </div>
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
                      {leadUser ? (
                        <img
                          src={leadUser.avatar || getDefaultAvatar(leadUser.id)}
                          alt={leadName}
                          className="w-7 h-7 rounded-full border border-slate-200 object-cover"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold">
                          ?
                        </div>
                      )}
                      <span>{leadName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      {visibleMembers.map((member) => {
                        const memberName = member.user.name || member.user.email || "?";

                        return (
                          <img
                            key={member.userId}
                            src={member.user.avatar || getDefaultAvatar(member.user.id)}
                            alt={memberName}
                            title={memberName}
                            className="-ml-1 h-7 w-7 rounded-full border-2 border-white object-cover first:ml-0"
                          />
                        );
                      })}
                      {hiddenMembers.length > 0 && (
                        <span
                          title={hiddenMembers.map((member) => member.user.name || member.user.email || "?").join(", ")}
                          className="-ml-1 inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-[11px] font-semibold text-slate-600 first:ml-0"
                        >
                          +{hiddenMembers.length}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{project._count.issues}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-3">
                      <a
                        href={`/projects/select?projectId=${project.id}`}
                        className={`inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
                          isSelected
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 pointer-events-none"
                            : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                        }`}
                      >
                        {isSelected ? translations.projectsPage.selected : translations.projectsPage.select}
                      </a>
                      {canManageSettings && (
                        <Link
                          href={`/projects/${project.id}/settings`}
                          className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100"
                        >
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
