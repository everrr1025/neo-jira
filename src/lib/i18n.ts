export const LANGUAGE_COOKIE = "lang";

export const SUPPORTED_LOCALES = ["en", "zh"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export function normalizeLocale(value?: string | null): Locale {
  return value === "zh" ? "zh" : DEFAULT_LOCALE;
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
  notificationsMenu: {
    title: string;
    noNotifications: string;
    markAllRead: string;
    systemActor: string;
    unreadSuffix: string;
  };
  dashboard: {
    title: string;
    searchResultsFor: string;
    clearSearch: string;
    noIssuesFound: string;
    totalIssues: string;
    toDo: string;
    inProgress: string;
    inTesting: string;
    done: string;
    activeStatus: string;
    viewBoard: string;
    daysLeft: string;
    issuesInSprint: string;
    completedIssues: string;
    sprintProgress: string;
    sprintEnds: string;
    activeSprint: string;
    noActiveSprint: string;
    assignedToMe: string;
    noTasksAssigned: string;
    highPriority: string;
    noHighPriorityIssues: string;
    overdue: string;
    noOverdueIssues: string;
    viewAll: string;
    watchedIssues: string;
    notWatchingAnyActiveIssues: string;
    dueSoon: string;
    noTasksDueThisWeek: string;
    recentActivity: string;
    noRecentActivity: string;
    activityForIssue: string;
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
    due: string;
    searchPlaceholder: string;
    allStatus: string;
    allTypes: string;
    allPriorities: string;
    allUsers: string;
    allDue: string;
    overdue: string;
    dueSoon: string;
    dateEquals: string;
    dateOnOrAfter: string;
    dateOnOrBefore: string;
    dateBetween: string;
    startDate: string;
    endDate: string;
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
    perPage: string;
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
    attachments: string;
    addAttachment: string;
    uploadFailed: string;
    attachmentTooLarge: string;
    removeAttachment: string;
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
    edit: string;
    cancel: string;
    save: string;
    deleteIssue: string;
    deleteIssueConfirm: string;
    watch: string;
    unwatch: string;
    watching: string;
    watchers: string;
    noWatchers: string;
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
    fileTooLarge: string;
    uploadFailed: string;
    deleteFailed: string;
    delete: string;
    confirmDelete: string;
    confirm: string;
    cancel: string;
  };
  activitySection: {
    title: string;
    loading: string;
    noActivity: string;
    unknownUser: string;
    issueCreated: string;
    issueDeleted: string;
    changed: string;
    from: string;
    to: string;
    updatedDescription: string;
    commentAdded: string;
    commentUpdated: string;
    commentDeleted: string;
    attachmentAdded: string;
    attachmentDeleted: string;
    emptyValue: string;
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
  settingsPage: {
    title: string;
    subtitle: string;
    profile: string;
    profileHint: string;
    language: string;
    languageHint: string;
    english: string;
    chinese: string;
    avatar: string;
    avatarHint: string;
    security: string;
    securityHint: string;
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
    passwordRule: string;
    updatePassword: string;
    updatingPassword: string;
    passwordUpdated: string;
    passwordMismatch: string;
    incorrectCurrentPassword: string;
    newPasswordMustDiffer: string;
    passwordUpdateFailed: string;
    openSettings: string;
  };
};

const translations: Record<Locale, TranslationBundle> = {
  en: {
    header: {
      workspaceOverview: "Dashboard",
      issues: "Issues",
      projects: "Projects",
      iterations: "Iterations",
      adminSettings: "Administration",
      login: "Login",
      appName: "Neo-Jira",
      searchPlaceholder: "Search issues by key or title...",
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
      markAllRead: "Mark all as read",
      noNotifications: "No notifications",
      signOut: "Sign out",
      userFallback: "User",
      chooseAvatar: "Choose avatar",
      changeAvatar: "Change avatar",
      close: "Close",
    },
    notificationsMenu: {
      title: "Notifications",
      noNotifications: "No notifications yet",
      markAllRead: "Mark all as read",
      systemActor: "System",
      unreadSuffix: "new",
    },
    dashboard: {
      title: "Dashboard",
      searchResultsFor: "Search results for",
      clearSearch: "Clear search",
      noIssuesFound: "No issues found matching",
      totalIssues: "Total issues",
      toDo: "To do",
      inProgress: "In progress",
      inTesting: "In testing",
      done: "Done",
      activeStatus: "Active",
      viewBoard: "View board",
      daysLeft: "Days left",
      issuesInSprint: "Issues in sprint",
      completedIssues: "Completed issues",
      sprintProgress: "Sprint progress",
      sprintEnds: "Sprint ends",
      activeSprint: "Active sprint",
      noActiveSprint: "No active sprint",
      assignedToMe: "Assigned to me",
      noTasksAssigned: "No tasks assigned",
      highPriority: "High priority",
      noHighPriorityIssues: "No high-priority issues",
      overdue: "Overdue",
      noOverdueIssues: "No overdue issues",
      viewAll: "View all",
      watchedIssues: "Watched issues",
      notWatchingAnyActiveIssues: "You are not watching any active issues",
      dueSoon: "Due soon (next 3 days)",
      noTasksDueThisWeek: "No tasks due in the next 3 days",
      recentActivity: "Recent activity",
      noRecentActivity: "No recent activity",
      activityForIssue: "Issue",
    },
    issuesPage: {
      title: "All Issues",
      subtitle: "View, filter, and search issues in the active project.",
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
      adminSubtitle: "Manage and review all workspaces.",
      memberSubtitle: "Select a project first, then open its Dashboard, Issues, and Iterations.",
      createProject: "Create project",
      project: "Project",
      key: "Key",
      lead: "Lead",
      members: "Members",
      openIssues: "Open issues",
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
      due: "Due",
      searchPlaceholder: "Search by title or key...",
      allStatus: "All statuses",
      allTypes: "All types",
      allPriorities: "All priorities",
      allUsers: "All users",
      allDue: "All dates",
      overdue: "Overdue",
      dueSoon: "Due soon (next 3 days)",
      dateEquals: "Equals",
      dateOnOrAfter: "On or after",
      dateOnOrBefore: "On or before",
      dateBetween: "Between",
      startDate: "Start date",
      endDate: "End date",
      assignedToMe: "Assigned to me",
      unassigned: "Unassigned",
      backlog: "Backlog",
      noMatchTitle: "No issues match the current filters",
      noMatchDesc: "Try adjusting the filters or create a new issue.",
      showing: "Showing",
      to: "to",
      of: "of",
      issues: "issues",
      page: "Page",
      allSprints: "All sprints",
      clearSelection: "Clear",
      sortBy: "Sort by",
      sortDirection: "Direction",
      createdAtSort: "Created time",
      keySort: "Key",
      titleSort: "Title",
      statusSort: "Status",
      typeSort: "Type",
      prioritySort: "Priority",
      sprintSort: "Sprint",
      ascending: "Ascending",
      descending: "Descending",
      perPage: "Per page",
    },
    createIssue: {
      create: "Create",
      createNewIssue: "Create new issue",
      modalTitle: "Create issue",
      summary: "Summary",
      summaryPlaceholder: "What needs to be done?",
      issueType: "Issue type",
      priority: "Priority",
      sprint: "Sprint",
      assignee: "Assignee",
      dueDate: "Due date",
      description: "Description",
      mentionSomeone: "Mention someone",
      cancel: "Cancel",
      creating: "Creating...",
      failedCreateIssue: "Failed to create issue",
      attachments: "Attachments",
      addAttachment: "Add attachment",
      uploadFailed: "Upload failed",
      attachmentTooLarge: "File size cannot exceed 50 MB.",
      removeAttachment: "Remove attachment",
    },
    createSprint: {
      createSprint: "Create sprint",
      modalTitle: "Create sprint",
      project: "Project",
      sprintName: "Sprint name",
      sprintNamePlaceholder: "Sprint 6",
      startDate: "Start date",
      endDate: "End date",
      failedCreateSprint: "Failed to create sprint",
    },
    iterationDetail: {
      backToSprints: "Back to sprints",
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
      addToSprint: "Add to sprint",
      adding: "Adding...",
      failed: "Failed to add issues",
    },
    issueDetail: {
      back: "Back",
      issueSummaryPlaceholder: "Issue summary",
      description: "Description",
      mentionSomeone: "Mention someone",
      saveChanges: "Save changes",
      saved: "Saved",
      properties: "Properties",
      status: "Status",
      sprint: "Sprint",
      type: "Type",
      priority: "Priority",
      assignee: "Assignee",
      dueDate: "Due date",
      reporter: "Reporter",
      unknown: "Unknown",
      created: "Created",
      updated: "Updated",
      failedToSave: "Failed to save changes",
      edit: "Edit",
      cancel: "Cancel",
      save: "Save",
      deleteIssue: "Delete issue",
      deleteIssueConfirm: "Delete this issue? This action cannot be undone.",
      watch: "Watch",
      unwatch: "Unwatch",
      watching: "Watching",
      watchers: "Watchers",
      noWatchers: "No watchers yet",
    },
    commentSection: {
      title: "Comments",
      loading: "Loading comments...",
      me: "Me",
      mentionSomeone: "Mention someone",
      postComment: "Post comment",
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
      addFile: "Add file",
      fileTooLarge: "File size cannot exceed 50 MB.",
      uploadFailed: "Upload failed",
      deleteFailed: "Failed to delete attachment",
      delete: "Delete",
      confirmDelete: "Delete this attachment?",
      confirm: "Confirm",
      cancel: "Cancel",
    },
    activitySection: {
      title: "Activity",
      loading: "Loading activity...",
      noActivity: "No activity yet.",
      unknownUser: "Someone",
      issueCreated: "created the issue",
      issueDeleted: "deleted the issue",
      changed: "changed",
      from: "from",
      to: "to",
      updatedDescription: "updated the description",
      commentAdded: "added a comment",
      commentUpdated: "updated a comment",
      commentDeleted: "deleted a comment",
      attachmentAdded: "uploaded an attachment",
      attachmentDeleted: "removed an attachment",
      emptyValue: "empty",
    },
    kanban: {
      dropHere: "Drop here",
    },
    sprintAction: {
      startSprint: "Start sprint",
      completeSprint: "Complete sprint",
      moreActions: "More actions",
      moveBackToPlanned: "Move back to planned",
      deleteSprint: "Delete sprint",
      completeTitle: "Complete sprint",
      completeDescription: "Choose where unfinished issues should move before completing this sprint.",
      unfinishedCount: "Unfinished issues",
      moveUnfinishedTo: "Move unfinished issues to",
      moveToBacklog: "Backlog",
      moveToSprint: "A planned sprint",
      recommended: "Recommended",
      noPlannedSprints: "No planned sprints available.",
      cancel: "Cancel",
      completing: "Completing...",
      confirmComplete: "Complete sprint",
      actionFailed: "Action failed",
      deleteConfirm: "Delete this sprint? All issues in it will move back to the backlog.",
      deleteFailed: "Failed to delete sprint",
    },
    settingsPage: {
      title: "Settings",
      subtitle: "Manage your personal preferences and account security.",
      profile: "Profile",
      profileHint: "Update how you appear across the workspace.",
      language: "Language",
      languageHint: "Choose the language used across the interface.",
      english: "English",
      chinese: "Chinese",
      avatar: "Avatar",
      avatarHint: "Pick an avatar that teammates will recognize.",
      security: "Security",
      securityHint: "Change your password to keep your account secure.",
      currentPassword: "Current password",
      newPassword: "New password",
      confirmPassword: "Confirm password",
      passwordRule:
        "Use at least 8 characters and include at least 3 of: uppercase, lowercase, number, special character.",
      updatePassword: "Update password",
      updatingPassword: "Updating...",
      passwordUpdated: "Password updated successfully.",
      passwordMismatch: "The new passwords do not match.",
      incorrectCurrentPassword: "The current password is incorrect.",
      newPasswordMustDiffer: "The new password must be different from the current password.",
      passwordUpdateFailed: "Failed to update password.",
      openSettings: "Open settings",
    },
  },
  zh: {
    header: {
      workspaceOverview: "仪表盘",
      issues: "问题",
      projects: "项目",
      iterations: "迭代",
      adminSettings: "系统管理",
      login: "登录",
      appName: "Neo-Jira",
      searchPlaceholder: "按编号或标题搜索问题...",
      welcomeBack: "欢迎回来",
      language: "语言",
    },
    sidebar: {
      dashboard: "仪表盘",
      issues: "问题",
      iterations: "迭代",
      projects: "项目",
      admin: "管理后台",
      settings: "设置",
      messages: "消息",
      notifications: "通知",
      markAllRead: "全部标记为已读",
      noNotifications: "暂无通知",
      signOut: "退出登录",
      userFallback: "用户",
      chooseAvatar: "选择头像",
      changeAvatar: "更换头像",
      close: "关闭",
    },
    notificationsMenu: {
      title: "通知",
      noNotifications: "暂时还没有通知",
      markAllRead: "全部标记为已读",
      systemActor: "系统",
      unreadSuffix: "条新通知",
    },
    dashboard: {
      title: "仪表盘",
      searchResultsFor: "搜索结果：",
      clearSearch: "清除搜索",
      noIssuesFound: "没有找到匹配的问题：",
      totalIssues: "问题总数",
      toDo: "待办",
      inProgress: "进行中",
      inTesting: "测试中",
      done: "已完成",
      activeStatus: "进行中",
      viewBoard: "查看看板",
      daysLeft: "剩余天数",
      issuesInSprint: "迭代内问题",
      completedIssues: "已完成问题",
      sprintProgress: "迭代进度",
      sprintEnds: "迭代结束时间",
      activeSprint: "当前迭代",
      noActiveSprint: "暂无进行中的迭代",
      assignedToMe: "分配给我",
      noTasksAssigned: "暂无分配给我的任务",
      highPriority: "高优先级",
      noHighPriorityIssues: "暂无高优先级问题",
      overdue: "已逾期",
      noOverdueIssues: "暂无逾期问题",
      viewAll: "查看全部",
      watchedIssues: "我关注的问题",
      notWatchingAnyActiveIssues: "你当前没有关注中的活跃问题",
      dueSoon: "即将到期（3天内）",
      noTasksDueThisWeek: "未来 3 天内没有即将到期的任务",
      recentActivity: "最近活动",
      noRecentActivity: "暂无最近活动",
      activityForIssue: "关联问题",
    },
    issuesPage: {
      title: "全部问题",
      subtitle: "查看、筛选并搜索当前项目中的问题。",
    },
    iterationsPage: {
      title: "迭代 / Sprint",
      subtitle: "规划并管理团队迭代。",
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
      key: "编号",
      summary: "摘要",
      sprint: "迭代",
      status: "状态",
      type: "类型",
      priority: "优先级",
      assignee: "经办人",
      due: "到期时间",
      searchPlaceholder: "按标题或编号搜索...",
      allStatus: "全部状态",
      allTypes: "全部类型",
      allPriorities: "全部优先级",
      allUsers: "全部成员",
      allDue: "全部日期",
      overdue: "已逾期",
      dueSoon: "即将到期（3天内）",
      dateEquals: "等于",
      dateOnOrAfter: "大于等于",
      dateOnOrBefore: "小于等于",
      dateBetween: "介于之间",
      startDate: "开始日期",
      endDate: "结束日期",
      assignedToMe: "分配给我",
      unassigned: "未分配",
      backlog: "待办池",
      noMatchTitle: "没有符合当前筛选条件的问题",
      noMatchDesc: "请调整筛选条件，或创建一个新问题。",
      showing: "显示",
      to: "到",
      of: "共",
      issues: "条问题",
      page: "第",
      allSprints: "全部迭代",
      clearSelection: "清空",
      sortBy: "排序字段",
      sortDirection: "排序方向",
      createdAtSort: "创建时间",
      keySort: "编号",
      titleSort: "标题",
      statusSort: "状态",
      typeSort: "类型",
      prioritySort: "优先级",
      sprintSort: "迭代",
      ascending: "升序",
      descending: "降序",
      perPage: "每页",
    },
    createIssue: {
      create: "创建",
      createNewIssue: "创建新问题",
      modalTitle: "创建问题",
      summary: "摘要",
      summaryPlaceholder: "需要完成什么？",
      issueType: "问题类型",
      priority: "优先级",
      sprint: "迭代",
      assignee: "经办人",
      dueDate: "截止日期",
      description: "描述",
      mentionSomeone: "提及成员",
      cancel: "取消",
      creating: "创建中...",
      failedCreateIssue: "创建问题失败",
      attachments: "附件",
      addAttachment: "添加附件",
      uploadFailed: "上传失败",
      attachmentTooLarge: "文件大小不能超过 50 MB。",
      removeAttachment: "移除附件",
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
      searchPlaceholder: "按编号、标题或经办人搜索...",
      allUnfinished: "全部未完成",
      empty: "待办池中暂无可添加的未完成问题。",
      selected: "已选择",
      selectedSuffix: "个问题",
      addToSprint: "添加到迭代",
      adding: "添加中...",
      failed: "添加问题失败",
    },
    issueDetail: {
      back: "返回",
      issueSummaryPlaceholder: "问题摘要",
      description: "描述",
      mentionSomeone: "提及成员",
      saveChanges: "保存更改",
      saved: "已保存",
      properties: "属性",
      status: "状态",
      sprint: "迭代",
      type: "类型",
      priority: "优先级",
      assignee: "经办人",
      dueDate: "截止日期",
      reporter: "报告人",
      unknown: "未知",
      created: "创建于",
      updated: "更新于",
      failedToSave: "保存更改失败",
      edit: "编辑",
      cancel: "取消",
      save: "保存",
      deleteIssue: "删除问题",
      deleteIssueConfirm: "确定删除这个问题吗？此操作不可撤销。",
      watch: "关注",
      unwatch: "取消关注",
      watching: "已关注",
      watchers: "关注者",
      noWatchers: "暂无关注者",
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
      fileTooLarge: "文件大小不能超过 50 MB。",
      uploadFailed: "上传失败",
      deleteFailed: "删除附件失败",
      delete: "删除",
      confirmDelete: "确定删除这个附件吗？",
      confirm: "确认",
      cancel: "取消",
    },
    activitySection: {
      title: "活动记录",
      loading: "活动记录加载中...",
      noActivity: "暂无活动记录。",
      unknownUser: "某位成员",
      issueCreated: "创建了该问题",
      issueDeleted: "删除了该问题",
      changed: "修改了",
      from: "从",
      to: "到",
      updatedDescription: "更新了描述",
      commentAdded: "添加了评论",
      commentUpdated: "编辑了评论",
      commentDeleted: "删除了评论",
      attachmentAdded: "上传了附件",
      attachmentDeleted: "删除了附件",
      emptyValue: "空",
    },
    kanban: {
      dropHere: "拖拽到这里",
    },
    sprintAction: {
      startSprint: "开始 Sprint",
      completeSprint: "完成 Sprint",
      moreActions: "更多操作",
      moveBackToPlanned: "恢复为未开始",
      deleteSprint: "删除 Sprint",
      completeTitle: "完成 Sprint",
      completeDescription: "完成前请选择未完成问题的去向。",
      unfinishedCount: "未完成问题",
      moveUnfinishedTo: "将未完成问题移动到",
      moveToBacklog: "待办池",
      moveToSprint: "未开始的 Sprint",
      recommended: "推荐",
      noPlannedSprints: "暂无可选的未开始 Sprint。",
      cancel: "取消",
      completing: "完成中...",
      confirmComplete: "完成 Sprint",
      actionFailed: "操作失败",
      deleteConfirm: "确定删除这个 Sprint 吗？其中所有问题都会移回待办池。",
      deleteFailed: "删除 Sprint 失败",
    },
    settingsPage: {
      title: "设置",
      subtitle: "管理你的个人偏好和账户安全。",
      profile: "个人资料",
      profileHint: "更新你在工作区中的显示方式。",
      language: "语言",
      languageHint: "选择系统界面的显示语言。",
      english: "English",
      chinese: "中文",
      avatar: "头像",
      avatarHint: "选择一个让团队成员更容易识别的头像。",
      security: "安全",
      securityHint: "定期修改密码以提升账户安全性。",
      currentPassword: "当前密码",
      newPassword: "新密码",
      confirmPassword: "确认新密码",
      passwordRule: "至少 8 位，并至少包含以下 4 类中的 3 类：大写字母、小写字母、数字、特殊字符。",
      updatePassword: "更新密码",
      updatingPassword: "更新中...",
      passwordUpdated: "密码更新成功。",
      passwordMismatch: "两次输入的新密码不一致。",
      incorrectCurrentPassword: "当前密码不正确。",
      newPasswordMustDiffer: "新密码不能与当前密码相同。",
      passwordUpdateFailed: "更新密码失败。",
      openSettings: "打开设置",
    },
  },
};

export function getTranslations(locale: Locale) {
  return translations[locale] ?? translations.en;
}

export function getIssueStatusLabel(status: string, locale: Locale) {
  if (locale === "zh") {
    if (status === "TODO") return "待办";
    if (status === "IN_PROGRESS") return "进行中";
    if (status === "IN_TESTING") return "测试中";
    if (status === "DONE") return "已完成";
    return status.replaceAll("_", " ");
  }

  if (status === "TODO") return "To do";
  if (status === "IN_PROGRESS") return "In progress";
  if (status === "IN_TESTING") return "In testing";
  if (status === "DONE") return "Done";
  return status.replaceAll("_", " ");
}

export function getIssueTypeLabel(type: string, locale: Locale) {
  if (locale === "zh") {
    if (type === "TASK") return "任务";
    if (type === "STORY") return "需求";
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
  if (status === "PLANNED") return "Not started";
  if (status === "COMPLETED") return "Completed";
  return status;
}

export function getStatusLabel(status: string, locale: Locale) {
  return getIssueStatusLabel(status, locale);
}
