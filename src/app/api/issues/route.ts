import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  const iterationId = searchParams.get('iterationId');

  try {
    const whereClause: any = {};
    if (projectId) whereClause.projectId = projectId;
    if (iterationId) whereClause.iterationId = iterationId;

    const issues = await prisma.issue.findMany({
      where: whereClause,
      include: {
        assignee: { select: { name: true, email: true } },
        reporter: { select: { name: true, email: true } },
        project: { select: { key: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    return NextResponse.json(issues);
  } catch (error) {
    console.error("Failed to fetch issues:", error);
    return NextResponse.json({ error: "Failed to fetch issues" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, description, status, priority, type, projectId, iterationId, assigneeId, reporterId } = body;
    
    if (!title || !projectId || !reporterId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    
    // Generate Issue Key based on Project Key
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    
    const count = await prisma.issue.count({ where: { projectId } });
    const issueKey = `${project.key}-${count + 1}`;
    
    const issue = await prisma.issue.create({
      data: {
        key: issueKey,
        title,
        description,
        status: status || 'TODO',
        priority: priority || 'MEDIUM',
        type: type || 'TASK',
        projectId,
        iterationId,
        assigneeId,
        reporterId,
      }
    });
    
    return NextResponse.json(issue, { status: 201 });
  } catch (error) {
    console.error("Failed to create issue:", error);
    return NextResponse.json({ error: "Failed to create issue" }, { status: 500 });
  }
}
