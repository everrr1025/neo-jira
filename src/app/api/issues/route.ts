import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import prisma from '@/lib/prisma';
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/authOptions";
import { getNextIssueKey, isIssueKeyUniqueConstraintError } from "@/lib/issueKeys";
import { getProjectRole } from "@/lib/permissions";
import { getTerminalPlanIssueMessage, isTerminalPlanStatus } from "@/lib/planLifecycle";
import { getCurrentLocale } from "@/lib/serverLocale";
import {
  createDefaultWorkflowForProject,
  getInitialWorkflowStatusKey,
  type WorkflowStatusRecord,
} from "@/lib/workflows";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const planId = searchParams.get('planId');
    const iterationId = searchParams.get('iterationId');
    const whereClause: Prisma.IssueWhereInput = {
      project: { members: { some: { userId } } },
    };
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
    };
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const locale = await getCurrentLocale();

    const body = await request.json();
    const { title, description, status, priority, type, projectId, planId, iterationId, assigneeId } =
      body as CreateIssueBody;
    
    if (!title || !projectId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const projectRole = await getProjectRole(userId, projectId);
    if (!projectRole) {
      return NextResponse.json({ error: "Project membership required" }, { status: 403 });
    }

    if (planId) {
      if (projectRole !== "ADMIN") {
        return NextResponse.json({ error: "Project admin access required to assign a plan" }, { status: 403 });
      }
      const plan = await prisma.plan.findFirst({
        where: { id: planId, projectId },
        select: { id: true, status: true },
      });
      if (!plan) {
        return NextResponse.json({ error: "Plan not found in the project" }, { status: 400 });
      }
      if (isTerminalPlanStatus(plan.status)) {
        return NextResponse.json(
          { error: getTerminalPlanIssueMessage(plan.status, locale) },
          { status: 409 },
        );
      }
    }

    if (iterationId) {
      const iteration = await prisma.iteration.findFirst({
        where: { id: iterationId, projectId },
        select: { id: true, status: true },
      });
      if (!iteration) {
        return NextResponse.json({ error: "Sprint not found in the project" }, { status: 400 });
      }
      if (iteration.status === "COMPLETED") {
        return NextResponse.json({ error: "Cannot add issues to a completed sprint" }, { status: 400 });
      }
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

    if (assigneeId) {
      const assignee = await prisma.user.findFirst({
        where: {
          id: assigneeId,
          role: { not: "ADMIN" },
          disabledAt: null,
          projectMemberships: {
            some: { projectId },
          },
        },
        select: { id: true },
      });

      if (!assignee) {
        return NextResponse.json({ error: "Assignee is not available in the project" }, { status: 400 });
      }
    }
    
    const initialStatus = getInitialWorkflowStatusKey(project.workflowStatuses as WorkflowStatusRecord[]);
    const resolvedStatus = status || initialStatus;
    if (!project.workflowStatuses.some((workflowStatus) => workflowStatus.key === resolvedStatus)) {
      return NextResponse.json({ error: "Invalid workflow status" }, { status: 400 });
    }

    let issue: Awaited<ReturnType<typeof prisma.issue.create>> | null = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        issue = await prisma.$transaction(async (tx) => {
          if (planId) {
            const currentPlan = await tx.plan.findUnique({ where: { id: planId }, select: { status: true } });
            if (!currentPlan || isTerminalPlanStatus(currentPlan.status)) {
              throw new Error(
                currentPlan
                  ? getTerminalPlanIssueMessage(currentPlan.status, locale)
                  : "Plan not found",
              );
            }
          }
          const issueKey = await getNextIssueKey(tx, projectId, project.key);
          return tx.issue.create({
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
              reporterId: userId,
            }
          });
        });
        break;
      } catch (error) {
        if (attempt < 4 && isIssueKeyUniqueConstraintError(error)) {
          continue;
        }

        throw error;
      }
    }

    if (!issue) {
      return NextResponse.json({ error: "Failed to create issue" }, { status: 500 });
    }
    
    return NextResponse.json(issue, { status: 201 });
  } catch (error) {
    console.error("Failed to create issue:", error);
    return NextResponse.json({ error: "Failed to create issue" }, { status: 500 });
  }
}
