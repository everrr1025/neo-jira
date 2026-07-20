"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { type ReactElement, useState } from "react";
import {
  Bell,
  Building2,
  CalendarDays,
  ChevronLeft,
  ClipboardCheck,
  FileText,
  Home,
  ListTodo,
  RefreshCw,
  Settings,
  StickyNote,
  Users,
} from "lucide-react";

import { getTranslations, type Locale } from "@/lib/i18n";
import ProjectNavIcon from "@/components/ProjectNavIcon";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { AvatarPicker } from "./AvatarPicker";
import { SidebarUserMenu } from "./SidebarUserMenu";

function CollapsedSidebarTooltip({
  collapsed,
  label,
  children,
}: {
  collapsed: boolean;
  label: string;
  children: ReactElement;
}) {
  if (!collapsed) return children;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function SidebarClient({
  isAdmin,
  activeProject,
  canManageActiveProject,
  user,
  locale,
  departmentContext,
}: {
  isAdmin: boolean;
  activeProject: { id: string; name: string; key: string } | null;
  canManageActiveProject: boolean;
  user: { id?: string; name?: string | null; email?: string | null; avatar?: string | null } | null | undefined;
  locale: Locale;
  departmentContext?: { id: string; name: string; positionName?: string | null } | null;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const translations = getTranslations(locale);
  const isDepartmentRoute = pathname.startsWith("/departments/");
  const inProjectContext = Boolean(activeProject) && !isDepartmentRoute;
  const plansLabel = locale === "zh" ? "计划" : "Plans";
  const membersLabel = locale === "zh" ? "成员" : "Members";
  const notificationsLabel = locale === "zh" ? "通知" : "Notifications";
  const tasksLabel = locale === "zh" ? "任务" : "Tasks";
  const scheduleLabel = locale === "zh" ? "日程" : "Schedule";
  const notesLabel = locale === "zh" ? "笔记" : "Notes";
  const projectSettingsLabel = locale === "zh" ? "设置" : "Settings";
  const expandSidebarLabel = locale === "zh" ? "展开侧栏" : "Expand sidebar";
  const returnHref = departmentContext
    ? `/projects/select?projectId=clear&redirectTo=${encodeURIComponent(`/departments/${departmentContext.id}`)}`
    : "/projects/select?projectId=clear";
  const returnLabel = departmentContext ? (locale === "zh" ? "返回部门" : "Back to Department") : "Return to Portal";
  const sidebarTitle =
    inProjectContext && activeProject
      ? activeProject.name
      : departmentContext
        ? departmentContext.name
        : isAdmin
          ? locale === "zh"
            ? "系统管理"
            : "Neo-Jira Admin"
          : locale === "zh"
            ? "工作台"
            : "Workspace";
  const sidebarInitial = sidebarTitle.trim().charAt(0).toUpperCase() || "N";

  const getNavClass = (href: string) => {
    let isActive = false;
    if (href.includes("?")) {
      const [hrefPath] = href.split("?");
      const tab = new URLSearchParams(href.split("?")[1]).get("tab");
      const currentTab = searchParams.get("tab") || "tasks";
      isActive = pathname === hrefPath && tab === currentTab;
    } else if (departmentContext && href === `/departments/${departmentContext.id}`) {
      isActive = pathname === href;
    } else {
      isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
    }
    return cn(
      "group flex items-center whitespace-nowrap rounded-md py-2 text-sm transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50",
      collapsed ? "mx-3 justify-center" : "gap-3 px-3",
      isActive
        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground [&_svg]:text-sidebar-accent-foreground"
        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:[&_svg]:text-sidebar-accent-foreground"
    );
  };

  const navIconClass = "size-5 flex-shrink-0 text-sidebar-foreground/55 transition-colors";

  const topLevelItems = !inProjectContext
    ? [
        {
          id: "dashboard",
          href: departmentContext ? `/departments/${departmentContext.id}` : "/",
          icon: <Home className={navIconClass} />,
          label: translations.sidebar.dashboard,
        },
        {
          id: "projects",
          href: departmentContext ? `/departments/${departmentContext.id}/projects` : "/projects",
          icon: (
            <ProjectNavIcon className={navIconClass} />
          ),
          label: translations.sidebar.projects,
        },
        ...(departmentContext
          ? [
              {
                id: "department-tasks",
                href: `/departments/${departmentContext.id}/items?tab=tasks`,
                icon: <ListTodo className={navIconClass} />,
                label: tasksLabel,
              },
              {
                id: "department-schedule",
                href: `/departments/${departmentContext.id}/items?tab=schedule`,
                icon: <CalendarDays className={navIconClass} />,
                label: scheduleLabel,
              },
              {
                id: "department-notes",
                href: `/departments/${departmentContext.id}/items?tab=notes`,
                icon: <StickyNote className={navIconClass} />,
                label: notesLabel,
              },
              {
                id: "department-notifications",
                href: `/departments/${departmentContext.id}/notifications`,
                icon: <Bell className={navIconClass} />,
                label: notificationsLabel,
              },
              {
                id: "department-members",
                href: `/departments/${departmentContext.id}/members`,
                icon: <Users className={navIconClass} />,
                label: membersLabel,
              },
            ]
          : []),
      ]
    : [
        {
          id: "dashboard",
          href: "/",
          icon: <Home className={navIconClass} />,
          label: translations.sidebar.dashboard,
        },
        {
          id: "kanban",
          href: "/iterations",
          icon: <RefreshCw className={navIconClass} />,
          label: translations.sidebar.iterations,
        },
        {
          id: "issues",
          href: "/issues",
          icon: <FileText className={navIconClass} />,
          label: translations.sidebar.issues,
        },
        {
          id: "plans",
          href: "/plans",
          icon: <ClipboardCheck className={navIconClass} />,
          label: plansLabel,
        },
        ...(canManageActiveProject && activeProject
          ? [
              {
                id: "project-settings",
                href: `/projects/${activeProject.id}/settings`,
                icon: <Settings className={navIconClass} />,
                label: projectSettingsLabel,
              },
            ]
          : []),
      ];

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className={`relative sticky top-0 z-30 flex h-screen shrink-0 flex-col items-start overflow-visible border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out ${
          collapsed ? "w-20" : "w-64"
        }`}
      >
        <CollapsedSidebarTooltip collapsed={collapsed} label={expandSidebarLabel}>
          <Button
            type="button"
            variant="outline"
            size="icon-xs"
            onClick={() => setCollapsed(!collapsed)}
            className="absolute right-0 top-8 z-40 translate-x-1/2 rounded-full border-sidebar-border bg-background text-muted-foreground shadow-sm hover:text-foreground"
            aria-label={collapsed ? expandSidebarLabel : undefined}
          >
            <ChevronLeft className={`size-4 transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`} />
          </Button>
        </CollapsedSidebarTooltip>

      <div className={`flex h-16 w-full items-center ${collapsed ? "justify-center px-0" : "gap-3 p-6 pb-4"}`}>
        {((departmentContext && !inProjectContext) || inProjectContext) && !collapsed ? (
          <span className="truncate text-lg font-semibold leading-6 text-sidebar-foreground transition-opacity duration-200">
            {sidebarTitle}
          </span>
        ) : (
          <>
            <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-md bg-sidebar-primary font-bold text-sidebar-primary-foreground">
              {sidebarInitial}
            </div>
            <span
              className={`truncate text-sm font-semibold text-sidebar-foreground transition-opacity duration-200 ${
                collapsed ? "hidden w-0 opacity-0" : "opacity-100"
              }`}
            >
              {sidebarTitle}
            </span>
          </>
        )}
      </div>

      <nav className="w-full flex-1 space-y-1 overflow-hidden px-4">
        {inProjectContext ? (
          <CollapsedSidebarTooltip collapsed={collapsed} label={returnLabel}>
            <a
              href={returnHref}
              aria-label={collapsed ? returnLabel : undefined}
              className={`group flex items-center whitespace-nowrap rounded-md py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:[&_svg]:text-sidebar-accent-foreground ${
                collapsed ? "mx-3 justify-center" : "gap-3 px-3"
              }`}
            >
              <ChevronLeft className={navIconClass} />
              <span className={`text-sm font-medium ${collapsed ? "hidden w-0 opacity-0" : "opacity-100 transition-opacity duration-200"}`}>
                {returnLabel}
              </span>
            </a>
          </CollapsedSidebarTooltip>
        ) : null}

        {topLevelItems
          .filter((item) => {
            if (isAdmin && item.id !== "dashboard") return false;
            return true;
          })
          .map((item) => (
            <CollapsedSidebarTooltip key={item.id} collapsed={collapsed} label={item.label}>
              <Link href={item.href} className={getNavClass(item.href)} aria-label={collapsed ? item.label : undefined}>
                {item.icon}
                <span className={`${collapsed ? "hidden w-0 opacity-0" : "opacity-100 transition-opacity duration-200"}`}>
                  {item.label}
                </span>
              </Link>
            </CollapsedSidebarTooltip>
          ))}

        {isAdmin ? (
          <>
            <CollapsedSidebarTooltip collapsed={collapsed} label={locale === "zh" ? "用户" : "Users"}>
              <Link href="/admin/users" className={getNavClass("/admin/users")} aria-label={collapsed ? (locale === "zh" ? "用户" : "Users") : undefined}>
                <Users className={navIconClass} />
                <span className={`${collapsed ? "hidden w-0 opacity-0" : "opacity-100 transition-opacity duration-200"}`}>
                  {locale === "zh" ? "用户" : "Users"}
                </span>
              </Link>
            </CollapsedSidebarTooltip>
            <CollapsedSidebarTooltip collapsed={collapsed} label={locale === "zh" ? "部门" : "Departments"}>
              <Link href="/admin/departments" className={getNavClass("/admin/departments")} aria-label={collapsed ? (locale === "zh" ? "部门" : "Departments") : undefined}>
                <Building2 className={navIconClass} />
                <span className={`${collapsed ? "hidden w-0 opacity-0" : "opacity-100 transition-opacity duration-200"}`}>
                  {locale === "zh" ? "部门" : "Departments"}
                </span>
              </Link>
            </CollapsedSidebarTooltip>
          </>
        ) : null}
      </nav>

      <div className={`flex w-full border-t border-sidebar-border p-4 text-sm ${collapsed ? "justify-center px-0" : ""}`}>
        {collapsed ? (
          <CollapsedSidebarTooltip collapsed label={user?.name || translations.sidebar.userFallback}>
            <Link href="/settings">
              <AvatarPicker
                userKey={user?.id || user?.email || user?.name || "anonymous"}
                userName={user?.name || translations.sidebar.userFallback}
                locale={locale}
                initialAvatar={user?.avatar}
                size="sm"
                editable={false}
              />
            </Link>
          </CollapsedSidebarTooltip>
        ) : (
          <SidebarUserMenu
            userId={user?.id || user?.email || user?.name || "anonymous"}
            userName={user?.name || translations.sidebar.userFallback}
            userAvatar={user?.avatar}
            locale={locale}
            position={
              departmentContext
                ? departmentContext.positionName
                : isAdmin
                  ? locale === "zh"
                    ? "系统管理员"
                    : "Administrator"
                  : undefined
            }
          />
        )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
