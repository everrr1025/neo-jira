export const LANGUAGE_COOKIE = "lang";

export const SUPPORTED_LOCALES = ["en", "zh"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export function normalizeLocale(value?: string | null): Locale {
  if (value === "zh") return "zh";
  return DEFAULT_LOCALE;
}

export const localeDateMap: Record<Locale, string> = {
  en: "en-US",
  zh: "zh-CN",
};

type TranslationBundle = {
  header: {
    workspaceOverview: string;
    issues: string;
    projects: string;
    iterations: string;
    adminSettings: string;
    login: string;
    appName: string;
    searchPlaceholder: string;
    welcomeBack: string;
    language: string;
  };
  sidebar: {
    dashboard: string;
    issues: string;
    iterations: string;
    projects: string;
    admin: string;
    settings: string;
    messages: string;
    notifications: string;
    markAllRead: string;
    noNotifications: string;
    signOut: string;
    userFallback: string;
    chooseAvatar: string;
    changeAvatar: string;
    close: string;
  };
  dashboard: {
    title: string;
    searchResultsFor: string;
    clearSearch: string;
    noIssuesFound: string;
    totalIssues: string;
    toDo: string;
    inProgress: string;
    done: string;
    assignedToMe: string;
    noTasksAssigned: string;
    watchedIssues: string;
    notWatchingAnyActiveIssues: string;
    dueSoon: string;
    noTasksDueThisWeek: string;
  };
  issuesPage: {
    title: string;
    subtitle: string;
  };
  iterationsPage: {
    title: string;
    subtitle: string;
    issues: string;
    completed: string;
    progress: string;
    noIterations: string;
  };
  projectsPage: {
    title: string;
    adminSubtitle: string;
    memberSubtitle: string;
    createProject: string;
    project: string;
    key: string;
    lead: string;
    members: string;
    openIssues: string;
    actions: string;
    selected: string;
    select: string;
    settings: string;
    noProjects: string;
  };
  issueList: {
    key: string;
    summary: string;
    sprint: string;
    status: string;
    type: string;
    priority: string;
    assignee: string;
    searchPlaceholder: string;
    allStatus: string;
    allTypes: string;
    allPriorities: string;
    allUsers: string;
    assignedToMe: string;
    unassigned: string;
    backlog: string;
    noMatchTitle: string;
    noMatchDesc: string;
    showing: string;
    to: string;
    of: string;
    issues: string;
    page: string;
    allSprints: string;
    clearSelection: string;
    sortBy: string;
    sortDirection: string;
    createdAtSort: string;
    keySort: string;
    titleSort: string;
    statusSort: string;
    typeSort: string;
    prioritySort: string;
    sprintSort: string;
    ascending: string;
    descending: string;
  };
  createIssue: {
    create: string;
    createNewIssue: string;
    modalTitle: string;
    summary: string;
    summaryPlaceholder: string;
    issueType: string;
    priority: string;
    sprint: string;
    assignee: string;
    dueDate: string;
    description: string;
    mentionSomeone: string;
    cancel: string;
    creating: string;
    failedCreateIssue: string;
  };
  createSprint: {
    createSprint: string;
    modalTitle: string;
    project: string;
    sprintName: string;
    sprintNamePlaceholder: string;
    startDate: string;
    endDate: string;
    failedCreateSprint: string;
  };
  iterationDetail: {
    backToSprints: string;
    board: string;
    ends: string;
  };
  addExistingIssues: {
    button: string;
    modalTitle: string;
    searchPlaceholder: string;
    allUnfinished: string;
    empty: string;
    selected: string;
    selectedSuffix: string;
    addToSprint: string;
    adding: string;
    failed: string;
  };
  issueDetail: {
    back: string;
    issueSummaryPlaceholder: string;
    description: string;
    mentionSomeone: string;
    saveChanges: string;
    saved: string;
    properties: string;
    status: string;
    sprint: string;
    type: string;
    priority: string;
    assignee: string;
    dueDate: string;
    reporter: string;
    unknown: string;
    created: string;
    updated: string;
    failedToSave: string;
  };
  commentSection: {
    title: string;
    loading: string;
    me: string;
    mentionSomeone: string;
    postComment: string;
    editComment: string;
    saveComment: string;
    cancelEdit: string;
    edited: string;
    failedToSave: string;
    deleteComment: string;
    deleteConfirm: string;
    failedToDelete: string;
  };
  attachmentSection: {
    title: string;
    uploading: string;
    addFile: string;
  };
  kanban: {
    dropHere: string;
  };
  sprintAction: {
    startSprint: string;
    completeSprint: string;
    moreActions: string;
    moveBackToPlanned: string;
    deleteSprint: string;
    completeTitle: string;
    completeDescription: string;
    unfinishedCount: string;
    moveUnfinishedTo: string;
    moveToBacklog: string;
    moveToSprint: string;
    recommended: string;
    noPlannedSprints: string;
    cancel: string;
    completing: string;
    confirmComplete: string;
    actionFailed: string;
    deleteConfirm: string;
    deleteFailed: string;
  };
};

const translations: Record<Locale, TranslationBundle> = {
  en: {
    header: {
      workspaceOverview: "Dashboard",
      issues: "Issues",
      projects: "Projects",
      iterations: "Iterations",
      adminSettings: "Admin Settings",
      login: "Login",
      appName: "Neo-Jira",
      searchPlaceholder: "Search issues, projects...",
      welcomeBack: "Welcome back",
      language: "Language",
    },
    sidebar: {
      dashboard: "Dashboard",
      issues: "Issues",
      iterations: "Iterations",
      projects: "Projects",
      admin: "Admin",
      settings: "Settings",
      messages: "Messages",
      notifications: "Notifications",
      markAllRead: "Mark all read",
      noNotifications: "No notifications",
      signOut: "Sign out",
      userFallback: "User",
      chooseAvatar: "Choose Avatar",
      changeAvatar: "Change avatar",
      close: "Close",
    },
    dashboard: {
      title: "Dashboard",
      searchResultsFor: "Search Results for",
      clearSearch: "Clear Search",
      noIssuesFound: "No issues found matching",
      totalIssues: "Total Issues",
      toDo: "To Do",
      inProgress: "In Progress",
      done: "Done",
      assignedToMe: "Assigned to me",
      noTasksAssigned: "No tasks assigned",
      watchedIssues: "Watched Issues",
      notWatchingAnyActiveIssues: "Not watching any active issues",
      dueSoon: "Due Soon (7 Days)",
      noTasksDueThisWeek: "No tasks due this week",
    },
    issuesPage: {
      title: "All Issues",
      subtitle: "View, filter, and search all issues across the workspace.",
    },
    iterationsPage: {
      title: "Iterations / Sprints",
      subtitle: "Plan and manage team iterations.",
      issues: "Issues",
      completed: "Completed",
      progress: "Progress",
      noIterations: "No iterations found.",
    },
    projectsPage: {
      title: "Projects",
      adminSubtitle: "Manage and view all workspaces.",
      memberSubtitle: "Select one project first, then access its Dashboard, Issues, and Iterations.",
      createProject: "Create Project",
      project: "Project",
      key: "Key",
      lead: "Lead",
      members: "Members",
      openIssues: "Open Issues",
      actions: "Actions",
      selected: "Selected",
      select: "Select",
      settings: "Settings",
      noProjects: "No projects found.",
    },
    issueList: {
      key: "Key",
      summary: "Summary",
      sprint: "Sprint",
      status: "Status",
      type: "Type",
      priority: "Priority",
      assignee: "Assignee",
      searchPlaceholder: "Search by title or key...",
      allStatus: "All Status",
      allTypes: "All Types",
      allPriorities: "All Priorities",
      allUsers: "All Users",
      assignedToMe: "Assigned to Me",
      unassigned: "Unassigned",
      backlog: "Backlog",
      noMatchTitle: "No issues match the criteria",
      noMatchDesc: "Try adjusting your filters or creating a new issue.",
      showing: "Showing",
      to: "to",
      of: "of",
      issues: "issues",
      page: "Page",
      allSprints: "All Sprints",
      clearSelection: "Clear",
      sortBy: "Sort by",
      sortDirection: "Direction",
      createdAtSort: "Created Time",
      keySort: "Key",
      titleSort: "Title",
      statusSort: "Status",
      typeSort: "Type",
      prioritySort: "Priority",
      sprintSort: "Sprint",
      ascending: "Ascending",
      descending: "Descending",
    },
    createIssue: {
      create: "Create",
      createNewIssue: "Create new issue",
      modalTitle: "Create Issue",
      summary: "Summary",
      summaryPlaceholder: "What needs to be done?",
      issueType: "Issue Type",
      priority: "Priority",
      sprint: "Sprint",
      assignee: "Assignee",
      dueDate: "Due Date",
      description: "Description",
      mentionSomeone: "Mention someone",
      cancel: "Cancel",
      creating: "Creating...",
      failedCreateIssue: "Failed to create issue",
    },
    createSprint: {
      createSprint: "Create Sprint",
      modalTitle: "Create Sprint",
      project: "Project",
      sprintName: "Sprint Name",
      sprintNamePlaceholder: "Sprint 6",
      startDate: "Start Date",
      endDate: "End Date",
      failedCreateSprint: "Failed to create sprint",
    },
    iterationDetail: {
      backToSprints: "Back to Sprints",
      board: "Board",
      ends: "Ends",
    },
    addExistingIssues: {
      button: "Add issues",
      modalTitle: "Add issues to",
      searchPlaceholder: "Search by key, title, or assignee...",
      allUnfinished: "All unfinished",
      empty: "No unfinished backlog issues available.",
      selected: "Selected",
      selectedSuffix: "issues",
      addToSprint: "Add to Sprint",
      adding: "Adding...",
      failed: "Failed to add issues",
    },
    issueDetail: {
      back: "Back",
      issueSummaryPlaceholder: "Issue Summary",
      description: "Description",
      mentionSomeone: "Mention someone",
      saveChanges: "Save Changes",
      saved: "Saved",
      properties: "Properties",
      status: "Status",
      sprint: "Sprint",
      type: "Type",
      priority: "Priority",
      assignee: "Assignee",
      dueDate: "Due Date",
      reporter: "Reporter",
      unknown: "Unknown",
      created: "Created",
      updated: "Updated",
      failedToSave: "Failed to save changes",
    },
    commentSection: {
      title: "Comments",
      loading: "Loading comments...",
      me: "Me",
      mentionSomeone: "Mention someone",
      postComment: "Post Comment",
      editComment: "Edit",
      saveComment: "Save",
      cancelEdit: "Cancel",
      edited: "Edited",
      failedToSave: "Failed to save comment",
      deleteComment: "Delete",
      deleteConfirm: "Delete this comment?",
      failedToDelete: "Failed to delete comment",
    },
    attachmentSection: {
      title: "Attachments",
      uploading: "Uploading...",
      addFile: "Add File",
    },
    kanban: {
      dropHere: "Drop here",
    },
    sprintAction: {
      startSprint: "Start Sprint",
      completeSprint: "Complete Sprint",
      moreActions: "More actions",
      moveBackToPlanned: "Move back to planned",
      deleteSprint: "Delete Sprint",
      completeTitle: "Complete Sprint",
      completeDescription: "Choose where unfinished issues should move before this sprint is completed.",
      unfinishedCount: "Unfinished issues",
      moveUnfinishedTo: "Move unfinished issues to",
      moveToBacklog: "Backlog",
      moveToSprint: "A planned Sprint",
      recommended: "Recommended",
      noPlannedSprints: "No planned sprints available.",
      cancel: "Cancel",
      completing: "Completing...",
      confirmComplete: "Complete Sprint",
      actionFailed: "Action failed",
      deleteConfirm: "Delete this sprint? All issues in it will be moved to backlog.",
      deleteFailed: "Failed to delete sprint",
    },
  },
  zh: {
    header: {
      workspaceOverview: "仪表盘",
      issues: "问题",
      projects: "项目",
      iterations: "迭代",
      adminSettings: "管理员设置",
      login: "登录",
      appName: "Neo-Jira",
      searchPlaceholder: "搜索问题、项目...",
      welcomeBack: "欢迎回来",
      language: "语言",
    },
    sidebar: {
      dashboard: "仪表盘",
      issues: "问题",
      iterations: "迭代",
      projects: "项目",
      admin: "管理",
      settings: "设置",
      messages: "消息",
      notifications: "通知",
      markAllRead: "全部已读",
      noNotifications: "暂无通知",
      signOut: "退出登录",
      userFallback: "用户",
      chooseAvatar: "选择头像",
      changeAvatar: "更换头像",
      close: "关闭",
    },
    dashboard: {
      title: "仪表盘",
      searchResultsFor: "搜索结果：",
      clearSearch: "清除搜索",
      noIssuesFound: "没有找到匹配的问题：",
      totalIssues: "问题总数",
      toDo: "待办",
      inProgress: "进行中",
      done: "已完成",
      assignedToMe: "分配给我",
      noTasksAssigned: "暂无分配给我的任务",
      watchedIssues: "关注的问题",
      notWatchingAnyActiveIssues: "当前未关注活跃问题",
      dueSoon: "即将到期（7天内）",
      noTasksDueThisWeek: "本周没有即将到期任务",
    },
    issuesPage: {
      title: "所有问题",
      subtitle: "查看、筛选并搜索当前工作区内的问题。",
    },
    iterationsPage: {
      title: "迭代 / Sprint",
      subtitle: "规划和管理团队迭代。",
      issues: "问题数",
      completed: "已完成",
      progress: "进度",
      noIterations: "暂无迭代。",
    },
    projectsPage: {
      title: "项目",
      adminSubtitle: "管理并查看所有工作区。",
      memberSubtitle: "请先选择一个项目，然后访问该项目的仪表盘、问题和迭代。",
      createProject: "创建项目",
      project: "项目",
      key: "标识",
      lead: "负责人",
      members: "成员",
      openIssues: "未完成问题",
      actions: "操作",
      selected: "已选择",
      select: "选择",
      settings: "设置",
      noProjects: "暂无项目。",
    },
    issueList: {
      key: "标识",
      summary: "摘要",
      sprint: "Sprint",
      status: "状态",
      type: "类型",
      priority: "优先级",
      assignee: "经办人",
      searchPlaceholder: "按标题或标识搜索...",
      allStatus: "全部状态",
      allTypes: "全部类型",
      allPriorities: "全部优先级",
      allUsers: "全部用户",
      assignedToMe: "分配给我",
      unassigned: "未分配",
      backlog: "待办池",
      noMatchTitle: "没有匹配条件的问题",
      noMatchDesc: "请调整筛选条件，或创建一个新问题。",
      showing: "显示",
      to: "到",
      of: "共",
      issues: "条问题",
      page: "第",
      allSprints: "全部 Sprint",
      clearSelection: "清空",
      sortBy: "排序字段",
      sortDirection: "排序方向",
      createdAtSort: "创建时间",
      keySort: "标识",
      titleSort: "标题",
      statusSort: "状态",
      typeSort: "类型",
      prioritySort: "优先级",
      sprintSort: "Sprint",
      ascending: "升序",
      descending: "降序",
    },
    createIssue: {
      create: "创建",
      createNewIssue: "创建新问题",
      modalTitle: "创建问题",
      summary: "摘要",
      summaryPlaceholder: "需要完成什么？",
      issueType: "问题类型",
      priority: "优先级",
      sprint: "Sprint",
      assignee: "经办人",
      dueDate: "截止日期",
      description: "描述",
      mentionSomeone: "提及成员",
      cancel: "取消",
      creating: "创建中...",
      failedCreateIssue: "创建问题失败",
    },
    createSprint: {
      createSprint: "创建 Sprint",
      modalTitle: "创建 Sprint",
      project: "项目",
      sprintName: "Sprint 名称",
      sprintNamePlaceholder: "Sprint 6",
      startDate: "开始日期",
      endDate: "结束日期",
      failedCreateSprint: "创建 Sprint 失败",
    },
    iterationDetail: {
      backToSprints: "返回 Sprint 列表",
      board: "看板",
      ends: "结束于",
    },
    addExistingIssues: {
      button: "添加问题",
      modalTitle: "添加问题到",
      searchPlaceholder: "搜索编号、标题或经办人...",
      allUnfinished: "全部未完成",
      empty: "当前待办池没有可添加的未完成问题。",
      selected: "已选择",
      selectedSuffix: "个问题",
      addToSprint: "添加到 Sprint",
      adding: "添加中...",
      failed: "添加问题失败",
    },
    issueDetail: {
      back: "返回",
      issueSummaryPlaceholder: "问题摘要",
      description: "描述",
      mentionSomeone: "提及成员",
      saveChanges: "保存修改",
      saved: "已保存",
      properties: "属性",
      status: "状态",
      sprint: "Sprint",
      type: "类型",
      priority: "优先级",
      assignee: "经办人",
      dueDate: "截止日期",
      reporter: "报告人",
      unknown: "未知",
      created: "创建于",
      updated: "更新于",
      failedToSave: "保存修改失败",
    },
    commentSection: {
      title: "评论",
      loading: "评论加载中...",
      me: "我",
      mentionSomeone: "提及成员",
      postComment: "发表评论",
      editComment: "编辑",
      saveComment: "保存",
      cancelEdit: "取消",
      edited: "已编辑",
      failedToSave: "保存评论失败",
      deleteComment: "删除",
      deleteConfirm: "确定删除这条评论吗？",
      failedToDelete: "删除评论失败",
    },
    attachmentSection: {
      title: "附件",
      uploading: "上传中...",
      addFile: "添加文件",
    },
    kanban: {
      dropHere: "拖拽到这里",
    },
    sprintAction: {
      startSprint: "开始 Sprint",
      completeSprint: "完成 Sprint",
      moreActions: "更多操作",
      moveBackToPlanned: "回退为未开始",
      deleteSprint: "删除 Sprint",
      completeTitle: "完成 Sprint",
      completeDescription: "完成前请选择未完成问题的移动位置。",
      unfinishedCount: "未完成问题",
      moveUnfinishedTo: "将未完成问题移动到",
      moveToBacklog: "待办池",
      moveToSprint: "未开始 Sprint",
      recommended: "推荐",
      noPlannedSprints: "暂无可选的未开始 Sprint。",
      cancel: "取消",
      completing: "完成中...",
      confirmComplete: "完成 Sprint",
      actionFailed: "操作失败",
      deleteConfirm: "确定删除这个 Sprint 吗？其中所有问题会移动到待办池。",
      deleteFailed: "删除 Sprint 失败",
    },
  },
};

export function getTranslations(locale: Locale) {
  return translations[locale];
}

export function getIssueStatusLabel(status: string, locale: Locale) {
  if (locale === "zh") {
    if (status === "TODO") return "待办";
    if (status === "IN_PROGRESS") return "进行中";
    if (status === "IN_TESTING") return "测试中";
    if (status === "DONE") return "已完成";
    return status.replaceAll("_", " ");
  }

  if (status === "TODO") return "TO DO";
  if (status === "IN_PROGRESS") return "IN PROGRESS";
  if (status === "IN_TESTING") return "IN TESTING";
  if (status === "DONE") return "DONE";
  return status.replaceAll("_", " ");
}

export function getIssueTypeLabel(type: string, locale: Locale) {
  if (locale === "zh") {
    if (type === "TASK") return "任务";
    if (type === "STORY") return "故事";
    if (type === "BUG") return "缺陷";
    if (type === "EPIC") return "史诗";
    return type;
  }

  if (type === "TASK") return "Task";
  if (type === "STORY") return "Story";
  if (type === "BUG") return "Bug";
  if (type === "EPIC") return "Epic";
  return type;
}

export function getPriorityLabel(priority: string, locale: Locale) {
  if (locale === "zh") {
    if (priority === "LOW") return "低";
    if (priority === "MEDIUM") return "中";
    if (priority === "HIGH") return "高";
    if (priority === "URGENT") return "紧急";
    return priority;
  }

  if (priority === "LOW") return "Low";
  if (priority === "MEDIUM") return "Medium";
  if (priority === "HIGH") return "High";
  if (priority === "URGENT") return "Urgent";
  return priority;
}

export function getIterationStatusLabel(status: string, locale: Locale) {
  if (locale === "zh") {
    if (status === "ACTIVE") return "进行中";
    if (status === "PLANNED") return "未开始";
    if (status === "COMPLETED") return "已完成";
    return status;
  }

  if (status === "ACTIVE") return "Active";
  if (status === "PLANNED") return "Not Started";
  if (status === "COMPLETED") return "Completed";
  return status;
}

export function getStatusLabel(status: string, locale: Locale) {
  return getIssueStatusLabel(status, locale);
}
