import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from "@prisma/client";
import {
  createDefaultWorkflowForProject,
  getInitialWorkflowStatusKey,
  type WorkflowStatusRecord,
} from "@/lib/workflows";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  const planId = searchParams.get('planId');
  const iterationId = searchParams.get('iterationId');

  try {
    const whereClause: Prisma.IssueWhereInput = {};
    if (projectId) whereClause.projectId = projectId;
    if (planId) whereClause.planId = planId;
    if (iterationId) whereClause.iterationId = iterationId;

    const issues = await prisma.issue.findMany({
      where: whereClause,
      include: {
        assignee: { select: { name: true, email: true } },
        plan: { select: { id: true, name: true } },
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
    type CreateIssueBody = {
      title?: string;
      description?: string;
      status?: string;
      priority?: string;
      type?: string;
      projectId?: string;
      planId?: string | null;
      iterationId?: string | null;
      assigneeId?: string | null;
      reporterId?: string;
    };
    const body = await request.json();
    const { title, description, status, priority, type, projectId, planId, iterationId, assigneeId, reporterId } =
      body as CreateIssueBody;
    
    if (!title || !projectId || !reporterId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    
    // Generate Issue Key based on Project Key
    const project = await prisma.$transaction(async (tx) => {
      const existingProject = await tx.project.findUnique({
        where: { id: projectId },
        select: { id: true },
      });

      if (!existingProject) {
        return null;
      }

      const workflowStatusCount = await tx.projectWorkflowStatus.count({
        where: { projectId },
      });

      if (workflowStatusCount === 0) {
        await createDefaultWorkflowForProject(tx, projectId);
      }

      return tx.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          key: true,
          workflowStatuses: {
            select: {
              id: true,
              key: true,
              name: true,
              category: true,
              position: true,
              isInitial: true,
            },
            orderBy: { position: "asc" },
          },
        },
      });
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    
    const count = await prisma.issue.count({ where: { projectId } });
    const issueKey = `${project.key}-${count + 1}`;
    
    const initialStatus = getInitialWorkflowStatusKey(project.workflowStatuses as WorkflowStatusRecord[]);
    const resolvedStatus = status || initialStatus;
    if (!project.workflowStatuses.some((workflowStatus) => workflowStatus.key === resolvedStatus)) {
      return NextResponse.json({ error: "Invalid workflow status" }, { status: 400 });
    }

    const issue = await prisma.issue.create({
      data: {
        key: issueKey,
        title,
        description,
        status: resolvedStatus,
        priority: priority || 'MEDIUM',
        type: type || 'TASK',
        projectId,
        planId,
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
