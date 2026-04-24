import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { getCurrentLocale } from "@/lib/serverLocale";
import DepartmentManageClient from "@/components/DepartmentManageClient";

export const dynamic = "force-dynamic";

export default async function DepartmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: departmentId } = await params;
  const locale = await getCurrentLocale();
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const userId = (session.user as any).id;
  const userRole = (session.user as any).role;
  const isGlobalAdmin = userRole === "ADMIN";

  // Fetch department with members
  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      projects: {
        select: {
          id: true,
          name: true,
          key: true,
          owner: { select: { id: true, name: true, email: true } },
          _count: { select: { issues: true } },
        },
      },
    },
  });

  if (!department) redirect("/");

  // Check authorization: must be HEAD, ASSISTANT, or global admin
  const myMembership = department.members.find((m) => m.userId === userId);
  const isHead = myMembership?.role === "HEAD";
  const isAssistant = myMembership?.role === "ASSISTANT";
  if (!isGlobalAdmin && !isHead && !isAssistant) {
    redirect("/");
  }

  // Fetch all non-admin users for the "add member" dropdown
  const allUsers = await prisma.user.findMany({
    where: { role: { not: "ADMIN" } },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  const safeDept = {
    id: department.id,
    name: department.name,
    key: department.key,
    description: department.description,
    members: department.members.map((m) => ({
      userId: m.userId,
      role: m.role,
      userName: m.user.name,
      userEmail: m.user.email,
    })),
    projects: department.projects.map((p) => ({
      id: p.id,
      name: p.name,
      key: p.key,
      ownerName: p.owner.name || p.owner.email,
      issuesCount: p._count.issues,
    })),
  };

  const safeUsers = allUsers.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
  }));

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col space-y-6">
      <DepartmentManageClient
        department={safeDept}
        allUsers={safeUsers}
        locale={locale}
        currentUserId={userId}
        isHead={isHead}
      />
    </div>
  );
}
