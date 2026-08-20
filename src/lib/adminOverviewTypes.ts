export type UsageTrendPoint = {
  date: string;
  activeUsers: number;
  activeDepartments: number;
};

export type GovernanceLogSummary = {
  id: string;
  entityType: string;
  action: string;
  field: string | null;
  actorName: string;
  targetName: string;
  createdAt: string;
};

export type AdminOverviewData = {
  totals: { users: number; departments: number; projects: number };
  storage: { totalFiles: number; totalBytes: number; recentFiles: number; recentBytes: number };
  periods: Record<7 | 30, { activeUsers: number; activeDepartments: number; trend: UsageTrendPoint[] }>;
  inactive: Record<30 | 90, { count: number; departmentCount: number }>;
  recentLogs: GovernanceLogSummary[];
};
