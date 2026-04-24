import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import AdminPanelClient from "@/components/AdminPanelClient";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { getCurrentLocale } from "@/lib/serverLocale";

export const dynamic = "force-dynamic";

async function normalizeProjectAdminOwnership() {
  const normalUsers = await prisma.user.findMany({
    where: { role: { not: "ADMIN" } },
    select: { id: true },
  });
  const normalUserIds = normalUsers.map((user) => user.id);

  const projects = await prisma.project.findMany({
    select: {
      id: true,
      ownerId: true,
      owner: { select: { role: true } },
      members: {
        select: { userId: true, role: true, user: { select: { role: true } } },
      },
    },
  });

  for (const project of projects) {
    const nonAdminMembers = project.members.filter((member) => member.user.role !== "ADMIN");
    const adminMemberIds = project.members
      .filter((member) => member.user.role === "ADMIN")
      .map((member) => member.userId);

    let targetOwnerId = project.owner?.role === "ADMIN" ? "" : project.ownerId;
    if (!targetOwnerId) {
      targetOwnerId = nonAdminMembers[0]?.userId || normalUserIds[0] || "";
    }

    const targetMembership = targetOwnerId
      ? project.members.find((member) => member.userId === targetOwnerId)
      : null;
    const needsDeleteSystemAdmins = adminMemberIds.length > 0;
    const needsOwnerUpdate = !!targetOwnerId && project.ownerId !== targetOwnerId;
    const needsCreateTargetMembership = !!targetOwnerId && !targetMembership;
    const needsPromoteTargetMembership =
      !!targetOwnerId && !!targetMembership && targetMembership.role !== "ADMIN";
    const needsDemoteOtherAdmins =
      !!targetOwnerId && project.members.some((member) => member.role === "ADMIN" && member.userId !== targetOwnerId);

    if (
      !needsDeleteSystemAdmins &&
      !needsOwnerUpdate &&
      !needsCreateTargetMembership &&
      !needsPromoteTargetMembership &&
      !needsDemoteOtherAdmins
    ) {
      continue;
    }

    await prisma.$transaction(async (tx) => {
      if (needsDeleteSystemAdmins) {
        await tx.projectMember.deleteMany({
          where: { projectId: project.id, userId: { in: adminMemberIds } },
        });
      }

      if (!targetOwnerId) {
        return;
      }

      if (needsOwnerUpdate) {
        await tx.project.update({
          where: { id: project.id },
          data: { ownerId: targetOwnerId },
        });
      }

      if (needsCreateTargetMembership) {
        await tx.projectMember.create({
          data: { userId: targetOwnerId, projectId: project.id, role: "ADMIN" },
        });
      } else if (needsPromoteTargetMembership) {
        await tx.projectMember.update({
          where: { userId_projectId: { userId: targetOwnerId, projectId: project.id } },
          data: { role: "ADMIN" },
        });
      }

      if (needsDemoteOtherAdmins) {
        await tx.projectMember.updateMany({
          where: {
            projectId: project.id,
            role: "ADMIN",
            userId: { not: targetOwnerId },
          },
          data: { role: "MEMBER" },
        });
      }
    });
  }
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const initialTab = params.tab === "departments" ? "DEPARTMENTS" : "USERS";
  const locale = await getCurrentLocale();
  const text =
    locale === "zh"
      ? {
          title: "系统管理",
          subtitle: "管理工作区用户、项目和访问权限。",
        }
      : {
          title: "Administration",
          subtitle: "Manage workspace users, projects, and access control.",
        };

  const session = await getServerSession(authOptions);
  const currentUser = session?.user as { id?: string; role?: string } | undefined;

  if (!session || currentUser?.role !== "ADMIN") {
    redirect("/");
  }

  await normalizeProjectAdminOwnership();

  const users = await prisma.user.findMany({
    include: {
      _count: {
        select: { ownedProjects: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const projects = await prisma.project.findMany({
    include: {
      owner: true,
      members: {
        include: { user: true },
      },
      _count: { select: { issues: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const departments = await prisma.department.findMany({
    include: {
      members: {
        include: { user: true },
      },
      _count: { select: { projects: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const safeUsers = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    ownedProjectsCount: user._count.ownedProjects,
  }));

  const safeProjects = projects.map((project) => ({
    id: project.id,
    name: project.name,
    key: project.key,
    description: project.description,
    ownerId: project.ownerId,
    owner: {
      id: project.owner.id,
      name: project.owner.name,
      email: project.owner.email,
    },
    members: project.members.map((member) => ({
      userId: member.userId,
      role: member.role,
      userName: member.user.name,
      userEmail: member.user.email,
    })),
    issuesCount: project._count.issues,
    createdAt: project.createdAt.toISOString(),
  }));

  const safeDepartments = departments.map((dept) => ({
    id: dept.id,
    name: dept.name,
    key: dept.key,
    description: dept.description,
    members: dept.members.map((m) => ({
      userId: m.userId,
      role: m.role,
      userEmail: m.user.email,
      userName: m.user.name,
    })),
    projectsCount: dept._count.projects,
    createdAt: dept.createdAt.toISOString(),
  }));

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-800">{text.title}</h2>
        <p className="mt-1 text-sm text-slate-500">{text.subtitle}</p>
      </div>

      <AdminPanelClient
        initialUsers={safeUsers}
        initialProjects={safeProjects}
        initialDepartments={safeDepartments}
        locale={locale}
        currentUserId={currentUser?.id || ""}
        initialTab={initialTab}
      />
    </div>
  );
}
