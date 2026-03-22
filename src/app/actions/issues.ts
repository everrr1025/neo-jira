'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function updateIssueStatus(issueId: string, newStatus: string) {
  try {
    const updatedIssue = await prisma.issue.update({
      where: { id: issueId },
      data: { status: newStatus }
    });
    
    // Revalidate the issues page so data is fresh on reload
    revalidatePath('/issues');
    
    return { success: true, issue: updatedIssue };
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
    // Vibe coding: pull the active workspace implicitly
    const project = await prisma.project.findFirst();
    const user = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    const iteration = await prisma.iteration.findFirst({ where: { status: 'ACTIVE' } });
    
    if (!project || !user) throw new Error("Project or default user not found");
    
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
        reporterId: user.id,
      }
    });

    revalidatePath('/issues');
    return { success: true, issue: newIssue };
  } catch (error) {
    console.error('Failed to create issue:', error);
    return { success: false, error: 'Failed to create issue' };
  }
}

export async function updateIssue(issueId: string, data: any) {
  try {
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
