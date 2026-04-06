import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import AdminPanelClient from "@/components/AdminPanelClient";
import { getCurrentLocale } from "@/lib/serverLocale";

export const dynamic = 'force-dynamic';

async function normalizeProjectAdminOwnership() {
  const normalUsers = await prisma.user.findMany({
    where: { role: { not: "ADMIN" } },
    select: { id: true },
  });
  const normalUserIds = normalUsers.map((u) => u.id);

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
    const nonAdminMembers = project.members.filter((m) => m.user.role !== "ADMIN");
    const adminMemberIds = project.members.filter((m) => m.user.role === "ADMIN").map((m) => m.userId);

    let targetOwnerId = project.owner?.role === "ADMIN" ? "" : project.ownerId;
    if (!targetOwnerId) {
      targetOwnerId = nonAdminMembers[0]?.userId || normalUserIds[0] || "";
    }

    const targetMembership = targetOwnerId
      ? project.members.find((m) => m.userId === targetOwnerId)
      : null;
    const needsDeleteSystemAdmins = adminMemberIds.length > 0;
    const needsOwnerUpdate = !!targetOwnerId && project.ownerId !== targetOwnerId;
    const needsCreateTargetMembership = !!targetOwnerId && !targetMembership;
    const needsPromoteTargetMembership = !!targetOwnerId && !!targetMembership && targetMembership.role !== "ADMIN";
    const needsDemoteOtherAdmins =
      !!targetOwnerId && project.members.some((m) => m.role === "ADMIN" && m.userId !== targetOwnerId);

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

export default async function AdminPage() {
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
    orderBy: { createdAt: 'desc' }
  });
  
  const projects = await prisma.project.findMany({
    include: {
      owner: true,
      members: {
        include: { user: true }
      },
      _count: { select: { issues: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Extract safe structures to pass to client component bypassing TS constraints
  const safeUsers = users.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
    ownedProjectsCount: u._count.ownedProjects,
  }));

  const safeProjects = projects.map(p => ({
    id: p.id,
    name: p.name,
    key: p.key,
    description: p.description,
    ownerId: p.ownerId,
    owner: {
      id: p.owner.id,
      name: p.owner.name,
      email: p.owner.email,
    },
    members: p.members.map(m => ({
      userId: m.userId,
      role: m.role,
      userName: m.user.name,
      userEmail: m.user.email,
    })),
    issuesCount: p._count.issues,
    createdAt: p.createdAt.toISOString()
  }));

  return (
    <div className="flex flex-col h-full space-y-6 max-w-6xl mx-auto w-full">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">{text.title}</h2>
        <p className="text-sm text-slate-500 mt-1">{text.subtitle}</p>
      </div>

      <AdminPanelClient
        initialUsers={safeUsers}
        initialProjects={safeProjects}
        locale={locale}
        currentUserId={currentUser?.id || ""}
      />
    </div>
  );
}
