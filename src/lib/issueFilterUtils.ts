import { Prisma } from "@prisma/client";

export async function parseIssueSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
  projectId: string,
  lockedPlanId?: string
) {
  const getArray = (val: string | string[] | undefined): string[] => {
    if (!val) return [];
    const strVal = Array.isArray(val) ? val[0] : val;
    return strVal.split(",").filter(Boolean);
  };

  const getString = (val: string | string[] | undefined): string => {
    if (!val) return "";
    return Array.isArray(val) ? val[0] : val;
  };

  const status = getArray(searchParams.status);
  const type = getArray(searchParams.type);
  const priority = getArray(searchParams.priority);
  const sprint = getArray(searchParams.sprint);
  const assignee = getArray(searchParams.assignee);
  const plan = lockedPlanId ? [lockedPlanId] : getArray(searchParams.plan);
  const search = getString(searchParams.search);
  const dueFilter = getString(searchParams.dueFilter); // ALL, EQ, GTE, LTE
  const dueDate = getString(searchParams.dueDate);
  const duePreset = getString(searchParams.duePreset);

  const where: Prisma.IssueWhereInput = {
    projectId,
  };

  if (status.length > 0) where.status = { in: status };
  if (type.length > 0) where.type = { in: type };
  if (priority.length > 0) where.priority = { in: priority };
  
  if (sprint.length > 0) {
    if (sprint.includes("__BACKLOG__") && sprint.length === 1) {
      where.iterationId = null;
    } else if (sprint.includes("__BACKLOG__")) {
      where.OR = [
        { iterationId: { in: sprint.filter((s) => s !== "__BACKLOG__") } },
        { iterationId: null },
      ];
    } else {
      where.iterationId = { in: sprint };
    }
  }

  if (plan.length > 0) {
    if (plan.includes("__NO_PLAN__") && plan.length === 1) {
      where.planId = null;
    } else if (plan.includes("__NO_PLAN__")) {
      where.OR = [
        { planId: { in: plan.filter((p) => p !== "__NO_PLAN__") } },
        { planId: null },
      ];
    } else {
      where.planId = { in: plan };
    }
  }

  if (assignee.length > 0) {
    const filters: Prisma.IssueWhereInput[] = [];
    const validAssignees = assignee.filter((a) => a !== "ME" && a !== "UNASSIGNED");
    if (validAssignees.length > 0) {
      filters.push({ assigneeId: { in: validAssignees } });
    }
    // "ME" filter requires knowing the user ID, which should be handled by caller if needed
    // Assuming "ME" is translated to actual user ID before reaching here, or we pass currentUserId
    if (assignee.includes("UNASSIGNED")) {
      filters.push({ assigneeId: null });
    }
    
    if (filters.length > 0) {
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: filters }];
        delete where.OR;
      } else {
        where.OR = filters;
      }
    }
  }

  if (search) {
    const searchFilter: Prisma.IssueWhereInput = {
      OR: [
        { title: { contains: search } }, // Case-insensitive in supported DBs
        { key: { contains: search } }
      ]
    };
    if (where.AND) {
      (where.AND as Prisma.IssueWhereInput[]).push(searchFilter);
    } else if (where.OR) {
      where.AND = [{ OR: where.OR }, searchFilter];
      delete where.OR;
    } else {
      where.OR = searchFilter.OR;
    }
  }

  if (dueFilter && dueFilter !== "ALL" && dueDate) {
    const date = new Date(dueDate);
    date.setHours(0, 0, 0, 0);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    if (dueFilter === "EQ") {
      where.dueDate = { gte: date, lt: nextDay };
    } else if (dueFilter === "GTE") {
      where.dueDate = { gte: date };
    } else if (dueFilter === "LTE") {
      where.dueDate = { lt: nextDay };
    }
  } else if (duePreset === "NEXT_3_DAYS") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const threeDaysLater = new Date(today);
    threeDaysLater.setDate(threeDaysLater.getDate() + 4); // < 4 days later is <= 3 days later
    where.dueDate = { gte: today, lt: threeDaysLater };
  }

  const page = parseInt(getString(searchParams.page) || "1", 10) || 1;
  const pageSize = parseInt(getString(searchParams.pageSize) || "10", 10) || 10;
  const skip = (page - 1) * pageSize;
  const take = pageSize;

  const sortBy = getString(searchParams.sortBy) || "createdAt";
  const sortDirection = getString(searchParams.sortDirection) === "asc" ? "asc" : "desc";

  // Handle custom sort mappings
  const orderBy: Prisma.IssueOrderByWithRelationInput = {};
  if (sortBy === "sprint") orderBy.iterationId = sortDirection;
  else if (sortBy === "plan") orderBy.planId = sortDirection;
  else if (sortBy === "assignee") orderBy.assigneeId = sortDirection;
  else if (sortBy === "type") orderBy.type = sortDirection;
  else if (sortBy === "priority") orderBy.priority = sortDirection;
  else if (sortBy === "status") orderBy.status = sortDirection; // Note: this is alphabetical, not workflow order
  else if (sortBy === "dueDate") orderBy.dueDate = { sort: sortDirection, nulls: "last" };
  else if (sortBy === "key") orderBy.key = sortDirection;
  else if (sortBy === "title") orderBy.title = sortDirection;
  else orderBy.createdAt = sortDirection;

  return { where, skip, take, orderBy, page, pageSize };
}
