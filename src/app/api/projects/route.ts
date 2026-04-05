import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/authOptions";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id as string;
    const userRole = (session.user as any).role as string;
    const whereClause =
      userRole === "ADMIN"
        ? {}
        : { members: { some: { userId } } };

    const projects = await prisma.project.findMany({
      where: whereClause,
      include: {
        owner: true,
        _count: {
          select: { issues: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(projects);
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role as string;
    if (userRole !== "ADMIN") {
      return NextResponse.json({ error: "Only system admin can create projects" }, { status: 403 });
    }

    const body = await request.json();
    const name = body?.name?.trim();
    const key = body?.key?.trim()?.toUpperCase();
    const description = body?.description?.trim() || null;
    const ownerId = typeof body?.ownerId === "string" ? body.ownerId : "";
    const rawMemberIds: string[] = Array.isArray(body?.memberIds)
      ? body.memberIds.filter((id: unknown): id is string => typeof id === "string")
      : [];
    const memberIds = Array.from(new Set(rawMemberIds));

    if (!name || !key || !ownerId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (memberIds.length < 1) {
      return NextResponse.json({ error: "At least one project member is required" }, { status: 400 });
    }
    if (!memberIds.includes(ownerId)) {
      memberIds.push(ownerId);
    }

    const existing = await prisma.project.findUnique({ where: { key } });
    if (existing) {
      return NextResponse.json({ error: "Project key already exists" }, { status: 409 });
    }

    const candidateUsers = await prisma.user.findMany({
      where: { id: { in: [ownerId, ...memberIds] } },
      select: { id: true, role: true },
    });
    if (candidateUsers.length !== new Set([ownerId, ...memberIds]).size) {
      return NextResponse.json({ error: "Some selected users do not exist" }, { status: 400 });
    }
    if (candidateUsers.some((u) => u.role === "ADMIN")) {
      return NextResponse.json({ error: "System admin cannot be project owner or member" }, { status: 400 });
    }

    const project = await prisma.project.create({
      data: {
        name,
        key,
        description,
        ownerId,
      },
    });

    await prisma.projectMember.createMany({
      data: memberIds.map((memberId) => ({
        userId: memberId,
        projectId: project.id,
        role: memberId === ownerId ? "ADMIN" : "MEMBER",
      })),
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error("Failed to create project:", error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
