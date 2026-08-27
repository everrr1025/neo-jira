import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

const TARGET_TYPES = ["USER", "DEPARTMENT", "PROJECT"] as const;

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const currentUser = session?.user as { role?: string } | undefined;
  if (!session || currentUser?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") || "").trim().slice(0, 80);
  const requestedType = searchParams.get("type");
  const type = TARGET_TYPES.find((value) => value === requestedType);
  if (!query) return NextResponse.json([]);

  const [users, departments, projects, auditCandidates] = await Promise.all([
    !type || type === "USER"
      ? prisma.user.findMany({
          where: { OR: [{ name: { contains: query } }, { email: { contains: query } }] },
          select: { id: true, name: true, email: true },
          orderBy: [{ name: "asc" }, { email: "asc" }],
          take: 8,
        })
      : Promise.resolve([]),
    !type || type === "DEPARTMENT"
      ? prisma.department.findMany({
          where: { OR: [{ name: { contains: query } }, { key: { contains: query } }] },
          select: { id: true, name: true, key: true },
          orderBy: { name: "asc" },
          take: 8,
        })
      : Promise.resolve([]),
    !type || type === "PROJECT"
      ? prisma.project.findMany({
          where: { OR: [{ name: { contains: query } }, { key: { contains: query } }] },
          select: { id: true, name: true, key: true },
          orderBy: { name: "asc" },
          take: 8,
        })
      : Promise.resolve([]),
    prisma.auditLog.findMany({
      where: {
        entityType: { in: type ? [type] : [...TARGET_TYPES] },
        OR: [
          { targetNameSnapshot: { contains: query } },
          { targetKeySnapshot: { contains: query } },
        ],
      },
      select: {
        entityType: true,
        entityId: true,
        targetNameSnapshot: true,
        targetKeySnapshot: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 50,
    }),
  ]);

  const seenAuditTargets = new Set<string>();
  const auditTargets = auditCandidates.filter((log) => {
    const key = `${log.entityType}:${log.entityId}`;
    if (seenAuditTargets.has(key)) return false;
    seenAuditTargets.add(key);
    return true;
  });
  const [existingAuditUsers, existingAuditDepartments, existingAuditProjects] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: auditTargets.filter((target) => target.entityType === "USER").map((target) => target.entityId) } },
      select: { id: true },
    }),
    prisma.department.findMany({
      where: { id: { in: auditTargets.filter((target) => target.entityType === "DEPARTMENT").map((target) => target.entityId) } },
      select: { id: true },
    }),
    prisma.project.findMany({
      where: { id: { in: auditTargets.filter((target) => target.entityType === "PROJECT").map((target) => target.entityId) } },
      select: { id: true },
    }),
  ]);
  const existingAuditTargetKeys = new Set([
    ...existingAuditUsers.map((item) => `USER:${item.id}`),
    ...existingAuditDepartments.map((item) => `DEPARTMENT:${item.id}`),
    ...existingAuditProjects.map((item) => `PROJECT:${item.id}`),
  ]);
  const deletedTargets = auditTargets
    .filter((target) => !existingAuditTargetKeys.has(`${target.entityType}:${target.entityId}`))
    .map((target) => ({
      type: target.entityType,
      id: target.entityId,
      name: target.targetNameSnapshot || target.targetKeySnapshot || target.entityId,
      detail: target.targetKeySnapshot || "",
      deleted: true,
    }));

  return NextResponse.json([
    ...deletedTargets,
    ...users.map((user) => ({ type: "USER", id: user.id, name: user.name || user.email, detail: user.email })),
    ...departments.map((department) => ({ type: "DEPARTMENT", id: department.id, name: department.name, detail: department.key })),
    ...projects.map((project) => ({ type: "PROJECT", id: project.id, name: project.name, detail: project.key })),
  ].slice(0, 20), {
    headers: { "Cache-Control": "no-store" },
  });
}
