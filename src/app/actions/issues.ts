"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function updateIssueStatus(issueId: string, status: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new Error("Unauthorized");

    const issue = await prisma.issue.update({
      where: { id: issueId },
      data: { status }
    });
    
    revalidatePath('/issues');
    revalidatePath('/iterations');
    
    return { success: true, issue };
  } catch (error) {
    console.error('Failed to update issue status:', error);
    return { success: false, error: 'Failed to update issue status' };
  }
}

export async function createIssue(data: {
  title: string;
  description?: string;
  priority: string;
  type: string;
  iterationId?: string | null;
  assigneeId?: string | null;
}) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new Error("Unauthorized");

    const userId = (session.user as any).id;
    const project = await prisma.project.findFirst({
      where: { members: { some: { id: userId } } }
    });
    const iteration = await prisma.iteration.findFirst({ where: { status: 'ACTIVE' } });
    
    if (!project) throw new Error("Project not found or no access");
    
    const count = await prisma.issue.count({ where: { projectId: project.id } });
    const issueKey = `${project.key}-${count + 1}`;
    
    const newIssue = await prisma.issue.create({
      data: {
        key: issueKey,
        title: data.title,
        description: data.description,
        status: 'TODO',
        priority: data.priority,
        type: data.type,
        projectId: project.id,
        iterationId: data.iterationId !== undefined ? data.iterationId : iteration?.id,
        assigneeId: data.assigneeId,
        reporterId: userId,
      }
    });

    revalidatePath('/issues');
    revalidatePath('/iterations');
    
    return { success: true, issue: newIssue };
  } catch (error) {
    console.error('Failed to create issue:', error);
    return { success: false, error: 'Failed to create issue' };
  }
}

export async function updateIssue(issueId: string, data: any) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new Error("Unauthorized");

    const updatedIssue = await prisma.issue.update({
      where: { id: issueId },
      data
    });
    
    revalidatePath(`/issues/${issueId}`);
    revalidatePath('/issues');
    revalidatePath('/iterations');
    
    return { success: true, issue: updatedIssue };
  } catch (error) {
    console.error('Failed to update issue:', error);
    return { success: false, error: 'Failed to update issue' };
  }
}
