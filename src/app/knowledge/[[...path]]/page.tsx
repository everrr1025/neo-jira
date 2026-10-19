import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/authOptions";
import { getActiveProjectForUser } from "@/lib/activeProject";
import { getCurrentLocale } from "@/lib/serverLocale";
import { getProjectPath } from "@/lib/projectRoutes";
import { KnowledgeError, listKnowledge } from "@/lib/knowledge";
import { knowledgeUploadLimit } from "@/lib/knowledgeStorage";
import KnowledgeClient from "@/components/KnowledgeClient";

export const dynamic = "force-dynamic";
export default async function KnowledgePage({ params, searchParams }: {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) redirect("/login");
  const project = await getActiveProjectForUser(user.id, user.role);
  if (!project) notFound();
  const [{ path = [] }, query, locale] = await Promise.all([params, searchParams, getCurrentLocale()]);
  if (path.length > 1) notFound();
  const string = (value: string | string[] | undefined) => typeof value === "string" ? value : "";
  const options = { itemId: path[0], folderId: string(query.folder) || null, search: string(query.search), trash: query.trash === "1", favorites: query.favorites === "1", page: Math.max(1, Number.parseInt(string(query.page) || "1") || 1) };
  let data;
  try {
    data = await listKnowledge(project.id, user.id, options);
  } catch (error) {
    if (error instanceof KnowledgeError && ["FORBIDDEN", "NOT_FOUND", "INVALID"].includes(error.code)) notFound();
    throw error;
  }
  return <KnowledgeClient key={JSON.stringify([project.id, options])} initialData={data} projectId={project.id} basePath={getProjectPath(project.departmentId, project.id, "knowledge")} options={options} locale={locale} uploadLimit={knowledgeUploadLimit()} />;
}
