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

    const userId = (session.user as any).id as string;
    const userRole = (session.user as any).role as string;
    if (userRole !== "ADMIN") {
      return NextResponse.json({ error: "Only system admin can create projects" }, { status: 403 });
    }

    const body = await request.json();
    const name = body?.name?.trim();
    const key = body?.key?.trim()?.toUpperCase();
    const description = body?.description?.trim() || null;

    if (!name || !key) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const existing = await prisma.project.findUnique({ where: { key } });
    if (existing) {
      return NextResponse.json({ error: "Project key already exists" }, { status: 409 });
    }

    const project = await prisma.project.create({
      data: {
        name,
        key,
        description,
        ownerId: userId,
      },
    });

    await prisma.projectMember.create({
      data: { userId, projectId: project.id, role: "ADMIN" },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error("Failed to create project:", error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
