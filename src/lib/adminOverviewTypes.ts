export type UsageTrendPoint = {
  date: string;
  activeUsers: number;
  activeDepartments: number;
};

export type DepartmentResourceUsage = {
  id: string | null;
  name: string;
  key: string | null;
  users: number;
  projects: number;
  files: number;
  bytes: number;
};

export type AttentionDepartment = {
  id: string;
  name: string;
  key: string;
  users: number;
  activeUsers: number;
  inactiveUsers: number;
  eligibleUsers: number;
  activeRate: number;
};

export type UsageHealthSummary = {
  activeUsers: number;
  inactiveUsers: number;
  eligibleUsers: number;
  activeRate: number;
  attentionDepartmentCount: number;
  attentionDepartments: AttentionDepartment[];
  departments: AttentionDepartment[];
};

export type AdminOverviewData = {
  totals: { users: number; departments: number; projects: number };
  storage: { totalFiles: number; totalBytes: number; recentFiles: number; recentBytes: number };
  periods: Record<7 | 30, { activeUsers: number; activeDepartments: number; trend: UsageTrendPoint[] }>;
  inactive: Record<30 | 90, UsageHealthSummary>;
  departmentResources: DepartmentResourceUsage[];
};
