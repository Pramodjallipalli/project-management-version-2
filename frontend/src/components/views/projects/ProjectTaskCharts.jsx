import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  BarChart3, 
  PieChart, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Layers, 
  Users, 
  Loader2, 
  RefreshCw, 
  ChevronDown, 
  Award, 
  CalendarCheck, 
  AlertTriangle, 
  UserCheck, 
  Search, 
  X,
  User,
  Filter,
  Calendar,
  ArrowRight,
  Timer,
  CheckSquare,
  FolderKanban
} from 'lucide-react';
import { workItemsService } from '../../../services/workItems.service';
import { projectsService } from '../../../services/projects.service';
import { PROJECT_ROLE_LABELS } from '../../modals/AssignProjectRolesModal';
import { useAuth } from '../../../context/AuthContext';

const STATUS_CONFIG = {
  TODO: { label: 'To Do', color: '#94A3B8', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
  IN_PROGRESS: { label: 'In Progress', color: '#8B5CF6', bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
  IN_REVIEW: { label: 'In Review', color: '#3B82F6', bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  COMPLETED: { label: 'Completed', color: '#10B981', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
  BLOCKED: { label: 'Blocked', color: '#F43F5E', bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-300' },
};

const PRIORITY_CONFIG = {
  URGENT: { label: 'Urgent', color: '#E11D48', barClass: 'bg-rose-500', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200' },
  HIGH: { label: 'High', color: '#F97316', barClass: 'bg-orange-500', badgeClass: 'bg-orange-50 text-orange-700 border-orange-200' },
  MEDIUM: { label: 'Medium', color: '#EAB308', barClass: 'bg-amber-500', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' },
  LOW: { label: 'Low', color: '#10B981', barClass: 'bg-emerald-500', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

const TYPE_CONFIG = {
  EPIC: { label: 'Epics', color: '#7C3AED', badgeClass: 'bg-purple-100 text-purple-800 border-purple-200' },
  STORY: { label: 'Stories', color: '#059669', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  TASK: { label: 'Tasks', color: '#2563EB', badgeClass: 'bg-blue-100 text-blue-800 border-blue-200' },
  SUBTASK: { label: 'Subtasks', color: '#64748B', badgeClass: 'bg-slate-100 text-slate-800 border-slate-200' },
  BUG: { label: 'Bugs', color: '#DC2626', badgeClass: 'bg-rose-100 text-rose-800 border-rose-200' },
};

function AnalyticsSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden animate-pulse">
      {/* Header skeleton */}
      <div className="p-4 sm:p-5 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-200 shrink-0" />
          <div className="space-y-2">
            <div className="h-4 w-48 bg-slate-200 rounded" />
            <div className="h-3 w-72 bg-slate-100 rounded" />
          </div>
        </div>
        <div className="h-8 w-24 bg-slate-200 rounded-xl" />
      </div>

      {/* Filter row skeleton */}
      <div className="px-4 py-3 bg-slate-50/50 flex gap-3 border-b border-slate-100">
        <div className="h-7 w-28 bg-slate-200 rounded-lg" />
        <div className="h-7 w-28 bg-slate-200 rounded-lg" />
        <div className="h-7 w-28 bg-slate-200 rounded-lg" />
      </div>

      {/* KPI Cards skeleton */}
      <div className="p-4 sm:p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 border-b border-slate-100">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 space-y-2">
            <div className="h-3 w-16 bg-slate-200 rounded" />
            <div className="h-6 w-12 bg-slate-300 rounded" />
            <div className="h-2.5 w-20 bg-slate-200 rounded" />
          </div>
        ))}
      </div>

      {/* Charts skeleton */}
      <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="p-4 rounded-xl border border-slate-100 flex flex-col items-center justify-center min-h-[220px] space-y-3">
          <div className="w-32 h-32 rounded-full border-8 border-slate-200" />
          <div className="h-3 w-32 bg-slate-200 rounded" />
        </div>
        <div className="p-4 rounded-xl border border-slate-100 space-y-3">
          <div className="h-4 w-28 bg-slate-200 rounded mb-4" />
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between">
                  <div className="h-3 w-14 bg-slate-200 rounded" />
                  <div className="h-3 w-8 bg-slate-200 rounded" />
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-slate-200 rounded-full" style={{ width: `${(4 - i) * 22}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="p-4 rounded-xl border border-slate-100 space-y-3">
          <div className="h-4 w-32 bg-slate-200 rounded mb-4" />
          <div className="h-16 w-full bg-slate-100 rounded-lg" />
          <div className="h-10 w-full bg-slate-50 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export default function ProjectTaskCharts({ projectId = null, project = null, members = [], onNavigateTab = null, readOnly = false }) {
  const { user: authUser } = useAuth();
  const authRole = String(authUser?.role?.name || authUser?.role || authUser?.type || authUser?.user_type || '').toUpperCase();
  const currentUserId = authUser?.id || authUser?.user_id;

  // Filters State
  const [selectedProjectId, setSelectedProjectId] = useState(projectId || '');
  const [selectedSprintId, setSelectedSprintId] = useState('ALL');
  const [dateRangeFilter, setDateRangeFilter] = useState('ALL'); // 'ALL' | '7D' | '14D' | '30D' | 'THIS_MONTH'

  // Server Analytics & Raw Items
  const [analyticsData, setAnalyticsData] = useState(null);
  const [workItems, setWorkItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const analyticsDataRef = useRef(analyticsData);
  analyticsDataRef.current = analyticsData;

  // Determine project methodology
  const isKanban = Boolean(
    project?.methodology === 'KANBAN' || 
    analyticsData?.project?.methodology === 'KANBAN' ||
    analyticsData?.methodology === 'KANBAN'
  );

  // Default values for this Project Overview component
  const defaultProjectId = projectId || '';
  const defaultSprintId = 'ALL';
  const defaultDateRange = 'ALL';

  // Check if any active filter differs from default
  const isFiltersChanged = useMemo(() => {
    return (
      (!projectId && selectedProjectId !== defaultProjectId) ||
      (!isKanban && selectedSprintId !== defaultSprintId) ||
      (dateRangeFilter !== defaultDateRange)
    );
  }, [projectId, selectedProjectId, defaultProjectId, isKanban, selectedSprintId, defaultSprintId, dateRangeFilter, defaultDateRange]);

  const handleViewBoard = () => {
    const targetTab = isKanban ? 'kanban' : 'scrum';
    if (onNavigateTab) {
      onNavigateTab(targetTab);
    } else {
      window.dispatchEvent(new CustomEvent('project-tab-change', { detail: { tab: targetTab } }));
    }
  };

  // Effective project members (from props or from backend analytics response)
  const effectiveMembers = useMemo(() => {
    if (Array.isArray(members) && members.length > 0) return members;
    if (Array.isArray(analyticsData?.members) && analyticsData.members.length > 0) return analyticsData.members;
    return [];
  }, [members, analyticsData]);

  const isManager = authRole === 'MANAGER' || authRole === 'ADMIN' || authRole === 'SUPER_ADMIN';
  const isTechLead = 
    authRole === 'TECH_LEAD' || 
    Boolean(authUser?.is_tech_lead) || 
    Boolean(analyticsData?.is_tech_lead) || 
    effectiveMembers.some((m) => 
      (m.user_id === currentUserId || m.id === currentUserId) && 
      (m.project_role === 'TECH_LEAD' || m.role === 'TECH_LEAD')
    );

  const hasFullTeamAccess = isManager || isTechLead;
  const isInternUser = !hasFullTeamAccess;

  // Tab View Mode:
  // Intern: 'TASKS' (Tab A: Tasks & Graphs) | 'PERFORMANCE' (Tab B: Individual Performance)
  // Manager / Tech Lead: 'TASKS' | 'PERFORMANCE' (Team Performance) | 'BOTH'
  const [viewMode, setViewMode] = useState('TASKS');

  // Manager / Tech Lead Scope Dropdown
  const [selectedPerformanceFilter, setSelectedPerformanceFilter] = useState('ALL'); // 'ALL' | 'TECH_LEADS' | userId
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const dropdownRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Intern Personal Table Search & Filter (Tab B)
  const [personalSearchQuery, setPersonalSearchQuery] = useState('');
  const [personalStatusFilter, setPersonalStatusFilter] = useState('ALL');

  useEffect(() => {
    if (projectId && selectedProjectId !== projectId) {
      setSelectedProjectId(projectId);
    }
  }, [projectId, selectedProjectId]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const computeDateRange = (rangeKey) => {
    const end = new Date();
    const start = new Date();
    if (rangeKey === '7D') {
      start.setDate(start.getDate() - 7);
    } else if (rangeKey === '14D') {
      start.setDate(start.getDate() - 14);
    } else if (rangeKey === '30D') {
      start.setDate(start.getDate() - 30);
    } else if (rangeKey === 'THIS_MONTH') {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    }
    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  };

  const fetchAnalytics = useCallback(async (isManualRefresh = false) => {
    // Abort any ongoing request before firing a new one
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (isManualRefresh) {
      setIsRefreshing(true);
    } else if (!analyticsDataRef.current) {
      setLoading(true);
    }
    setError(null);

    try {
      const filterPayload = {};
      const activeProjId = selectedProjectId || projectId;
      if (activeProjId) filterPayload.project_id = activeProjId;
      if (selectedSprintId && selectedSprintId !== 'ALL') filterPayload.sprint_id = selectedSprintId;
      if (dateRangeFilter !== 'ALL') {
        const { start, end } = computeDateRange(dateRangeFilter);
        filterPayload.start_date = start;
        filterPayload.end_date = end;
      }
      if (isManualRefresh) {
        filterPayload.fresh = true;
      }

      // Fetch analytics via server-scoped endpoint with cancellation signal
      const analyticsRes = await workItemsService.getAnalytics(filterPayload, {
        signal: controller.signal,
        fresh: isManualRefresh,
      });

      if (!analyticsRes) {
        throw new Error('No analytics data received from server');
      }

      // Populate workItems directly from analytics task_breakdown without redundant secondary round-trip
      let sanitizedItems = analyticsRes.task_breakdown || [];
      if (analyticsRes.lead_project_ids?.length > 0 && !isManager && !activeProjId) {
        const leadSet = new Set(analyticsRes.lead_project_ids);
        sanitizedItems = sanitizedItems.filter((it) => leadSet.has(it.project_id));
      }

      setAnalyticsData(analyticsRes);
      setWorkItems(sanitizedItems);
      setError(null);
    } catch (err) {
      if (err.name === 'AbortError' || controller.signal.aborted) {
        return; // Request was cleanly cancelled, do not update state
      }
      console.error('Failed to fetch task analytics:', err);
      setError(err.message || 'Failed to load task analytics');
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [selectedProjectId, projectId, selectedSprintId, dateRangeFilter, isManager]);

  useEffect(() => {
    fetchAnalytics();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchAnalytics]);

  // Load assigned projects for user
  const [userProjects, setUserProjects] = useState([]);

  useEffect(() => {
    projectsService.getProjects({ my: true })
      .then((data) => {
        if (Array.isArray(data)) setUserProjects(data);
      })
      .catch((err) => console.error('Failed to load assigned projects for analytics filter:', err));
  }, []);

  // Accessible filter options returned from server
  const accessibleProjects = useMemo(() => {
    if (userProjects.length > 0) {
      return userProjects;
    }
    if (Array.isArray(analyticsData?.projects) && analyticsData.projects.length > 0) {
      return analyticsData.projects;
    }
    if (Array.isArray(analyticsData?.filters?.projects) && analyticsData.filters.projects.length > 0) {
      return analyticsData.filters.projects;
    }
    return projectId ? [{ id: projectId, name: 'Current Project' }] : [];
  }, [userProjects, analyticsData, projectId]);

  const accessibleSprints = useMemo(() => {
    return analyticsData?.filters?.sprints || [];
  }, [analyticsData]);

  // Tech leads set for Manager / Tech Lead team table
  const techLeadUserIds = useMemo(() => {
    const set = new Set();
    effectiveMembers.forEach((m) => {
      if (m.project_role === 'TECH_LEAD' || m.role === 'TECH_LEAD') {
        set.add(m.user_id || m.id);
      }
    });
    return set;
  }, [effectiveMembers]);

  // Member Performance Map for Manager / Tech Lead view
  const memberPerformanceMap = useMemo(() => {
    const map = new Map();

    effectiveMembers.forEach((m) => {
      const uid = m.user_id || m.id;
      const role = m.project_role || (m.role === 'TECH_LEAD' ? 'TECH_LEAD' : 'UNASSIGNED');
      map.set(uid, {
        userId: uid,
        name: m.name || m.user?.name || m.email || 'Member',
        email: m.email || m.user?.email || '',
        role,
        roleLabel: role === 'UNASSIGNED' ? 'Member' : (PROJECT_ROLE_LABELS[role] || role),
        isTechLead: role === 'TECH_LEAD' || m.role === 'TECH_LEAD',
        totalAssigned: 0,
        completed: 0,
        inProgress: 0,
        inReview: 0,
        blocked: 0,
        todo: 0,
        pastDue: 0,
        completedOnTime: 0,
        completionRate: 0,
        onTimeRate: 0,
      });
    });

    const now = new Date();
    workItems.forEach((w) => {
      const isPastDue = Boolean(
        w.due_date && 
        new Date(w.due_date) < now && 
        w.status !== 'COMPLETED'
      );

      const wasCompletedOnTime = Boolean(
        w.status === 'COMPLETED' &&
        (!w.due_date || new Date(w.completed_at || w.updated_at || w.due_date) <= new Date(w.due_date))
      );

      const assignees = Array.isArray(w.assignees) && w.assignees.length > 0 ? w.assignees : [];
      assignees.forEach((a) => {
        const uid = a.user_id || a.id;
        if (!uid) return;

        let entry = map.get(uid);
        if (!entry) {
          const isLead = techLeadUserIds.has(uid);
          entry = {
            userId: uid,
            name: a.name || a.email || 'Member',
            email: a.email || '',
            role: isLead ? 'TECH_LEAD' : 'MEMBER',
            roleLabel: isLead ? 'Tech Lead' : 'Member',
            isTechLead: isLead,
            totalAssigned: 0,
            completed: 0,
            inProgress: 0,
            inReview: 0,
            blocked: 0,
            todo: 0,
            pastDue: 0,
            completedOnTime: 0,
            completionRate: 0,
            onTimeRate: 0,
          };
          map.set(uid, entry);
        }

        entry.totalAssigned += 1;
        if (w.status === 'COMPLETED') {
          entry.completed += 1;
          if (wasCompletedOnTime) entry.completedOnTime += 1;
        } else if (w.status === 'IN_PROGRESS') {
          entry.inProgress += 1;
        } else if (w.status === 'IN_REVIEW') {
          entry.inReview += 1;
        } else if (w.status === 'BLOCKED') {
          entry.blocked += 1;
        } else if (w.status === 'TODO') {
          entry.todo += 1;
        }

        if (isPastDue) entry.pastDue += 1;
      });
    });

    map.forEach((entry) => {
      entry.completionRate = entry.totalAssigned > 0 
        ? Math.round((entry.completed / entry.totalAssigned) * 100) 
        : 0;
      entry.onTimeRate = entry.completed > 0 
        ? Math.round((entry.completedOnTime / entry.completed) * 100) 
        : (entry.totalAssigned > 0 && entry.pastDue === 0 ? 100 : 0);
    });

    return map;
  }, [effectiveMembers, workItems, techLeadUserIds]);

  const performanceRows = useMemo(() => {
    const list = Array.from(memberPerformanceMap.values());
    if (selectedPerformanceFilter === 'ALL') {
      return list.sort((a, b) => {
        if (a.isTechLead && !b.isTechLead) return -1;
        if (!a.isTechLead && b.isTechLead) return 1;
        const nameA = a.name || a.email || '';
        const nameB = b.name || b.email || '';
        return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
      });
    }
    if (selectedPerformanceFilter === 'TECH_LEADS') {
      return list.filter((m) => m.isTechLead).sort((a, b) => {
        const nameA = a.name || a.email || '';
        const nameB = b.name || b.email || '';
        return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
      });
    }
    return list.filter((m) => m.userId === selectedPerformanceFilter);
  }, [memberPerformanceMap, selectedPerformanceFilter]);

  // Primary Analytics Data Source
  // If server analytics exists, use it directly (already scoped server-side to the user/filters)
  // Otherwise, fallback to calculated stats from workItems
  const analytics = useMemo(() => {
    if (analyticsData && (isInternUser || selectedPerformanceFilter === 'ALL')) {
      return {
        total: analyticsData.total || 0,
        completed: analyticsData.completed || 0,
        inProgress: analyticsData.in_progress || 0,
        inReview: analyticsData.in_review || 0,
        todo: analyticsData.todo || 0,
        blocked: analyticsData.blocked || 0,
        pastDue: analyticsData.past_due ?? analyticsData.overdue_items_count ?? 0,
        overdueRate: analyticsData.overdue_rate || 0,
        scheduledItemsCount: analyticsData.scheduled_items_count || 0,
        completedOnTime: analyticsData.completed_on_time_count ?? analyticsData.completed_on_time ?? 0,
        completedWithDueDateCount: analyticsData.completed_with_due_date_count ?? 0,
        completedOnTimeRate: analyticsData.completed_on_time_rate,
        completionRate: analyticsData.completion_rate || 0,
        onTimeRate: analyticsData.completed_on_time_rate ?? analyticsData.on_time_rate ?? null,
        statusCounts: analyticsData.status_counts || {},
        priorityCounts: analyticsData.priority_counts || {},
        typeCounts: analyticsData.type_counts || {},
        storyPointsTotal: analyticsData.story_points_total || 0,
        storyPointsCompleted: analyticsData.story_points_completed || 0,
        totalLoggedHours: analyticsData.total_logged_hours || 0,
        totalLoggedMinutes: analyticsData.total_logged_minutes || 0,
        trends: analyticsData.trends || [],
        taskBreakdown: analyticsData.task_breakdown || [],
      };
    }

    // Local calculation fallback
    let items = workItems;
    if (isInternUser && currentUserId) {
      items = workItems.filter((w) => {
        const assignees = w.assignees || w.work_item_assignees || [];
        const assignedIds = [
          ...assignees.map((a) => a.user_id || a.userId || a.assignee_id || a.user?.id || a.id),
          ...(w.assignee_ids || w.assigneeIds || []),
        ].filter(Boolean).map(String);
        return assignedIds.includes(String(currentUserId));
      });
    } else if (!isInternUser && selectedPerformanceFilter !== 'ALL') {
      if (selectedPerformanceFilter === 'TECH_LEADS') {
        items = workItems.filter((w) => w.assignees?.some((a) => techLeadUserIds.has(a.user_id || a.id)));
      } else {
        items = workItems.filter((w) => w.assignees?.some((a) => (a.user_id || a.id) === selectedPerformanceFilter));
      }
    }

    const total = items.length;
    const completed = items.filter(w => w.status === 'COMPLETED').length;
    const inProgress = items.filter(w => w.status === 'IN_PROGRESS').length;
    const inReview = items.filter(w => w.status === 'IN_REVIEW').length;
    const blocked = items.filter(w => w.status === 'BLOCKED').length;
    const todo = items.filter(w => w.status === 'TODO').length;
    
    const scheduledItems = items.filter(w => Boolean(w.due_date && !isNaN(new Date(w.due_date).getTime())));
    const pastDue = items.filter(w => {
      if (w.status === 'COMPLETED') return false;
      if (!w.due_date) return false;
      const d = new Date(w.due_date);
      if (isNaN(d.getTime())) return false;
      if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) d.setUTCHours(23, 59, 59, 999);
      return new Date() > d;
    }).length;

    const eligibleCompletedItems = items.filter(w => {
      if (w.status !== 'COMPLETED') return false;
      if (!w.due_date) return false;
      const d = new Date(w.due_date);
      if (isNaN(d.getTime())) return false;
      const compDate = w.completed_at ? new Date(w.completed_at) : (w.updated_at ? new Date(w.updated_at) : null);
      return compDate && !isNaN(compDate.getTime());
    });
    const completedWithDueDateCount = eligibleCompletedItems.length;

    const completedOnTime = eligibleCompletedItems.filter(w => {
      const d = new Date(w.due_date);
      if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) d.setUTCHours(23, 59, 59, 999);
      const compDate = w.completed_at ? new Date(w.completed_at) : new Date(w.updated_at);
      return compDate <= d;
    }).length;

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const completedOnTimeRate = completedWithDueDateCount > 0 
      ? Math.round((completedOnTime / completedWithDueDateCount) * 100) 
      : null;
    const onTimeRate = completedOnTimeRate;

    return {
      total,
      completed,
      inProgress,
      inReview,
      todo,
      blocked,
      pastDue,
      scheduledItemsCount: scheduledItems.length,
      overdueRate: scheduledItems.length > 0 ? Math.round((pastDue / scheduledItems.length) * 100) : 0,
      completedOnTime,
      completedWithDueDateCount,
      completedOnTimeRate,
      onTimeRate,
      completionRate,
      statusCounts: { COMPLETED: completed, IN_PROGRESS: inProgress, IN_REVIEW: inReview, TODO: todo, BLOCKED: blocked },
      priorityCounts: {
        URGENT: items.filter(w => w.priority === 'URGENT').length,
        HIGH: items.filter(w => w.priority === 'HIGH').length,
        MEDIUM: items.filter(w => w.priority === 'MEDIUM').length,
        LOW: items.filter(w => w.priority === 'LOW').length,
      },
      typeCounts: {
        EPIC: items.filter(w => w.type === 'EPIC').length,
        STORY: items.filter(w => w.type === 'STORY').length,
        TASK: items.filter(w => w.type === 'TASK').length,
        SUBTASK: items.filter(w => w.type === 'SUBTASK').length,
        BUG: items.filter(w => w.type === 'BUG').length,
      },
      storyPointsTotal: items.reduce((sum, w) => sum + (Number(w.story_points) || 0), 0),
      storyPointsCompleted: items.filter(w => w.status === 'COMPLETED').reduce((sum, w) => sum + (Number(w.story_points) || 0), 0),
      totalLoggedHours: 0,
      totalLoggedMinutes: 0,
      trends: [],
      taskBreakdown: items.map(w => ({
        id: w.id,
        title: w.title,
        type: w.type,
        status: w.status,
        priority: w.priority,
        due_date: w.due_date,
        completed_at: w.completed_at,
        story_points: w.story_points || 0,
        logged_hours: 0,
        logged_minutes: 0,
        is_past_due: Boolean(w.due_date && new Date(w.due_date) < new Date() && w.status !== 'COMPLETED'),
        was_completed_on_time: Boolean(w.status === 'COMPLETED' && (!w.due_date || new Date(w.completed_at || w.updated_at || w.due_date) <= new Date(w.due_date))),
        project_name: w.project?.name || null,
      })),
    };
  }, [analyticsData, isInternUser, workItems, currentUserId, selectedPerformanceFilter, techLeadUserIds]);

  // Donut chart calculations
  const donutSize = 160;
  const strokeWidth = 22;
  const radius = (donutSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const donutSegments = useMemo(() => {
    if (analytics.total === 0) return [];
    let accumulatedAngle = 0;
    return Object.entries(STATUS_CONFIG).map(([statusKey, config]) => {
      const count = analytics.statusCounts[statusKey] || 0;
      const percentage = (count / analytics.total) * 100;
      const dash = (percentage / 100) * circumference;
      const offset = -((accumulatedAngle / 100) * circumference);
      accumulatedAngle += percentage;
      return {
        statusKey,
        config,
        count,
        percentage,
        strokeDasharray: `${dash} ${circumference}`,
        strokeDashoffset: offset,
      };
    }).filter(seg => seg.count > 0);
  }, [analytics, circumference]);

  // Filtered Personal Tasks for Tab B (Individual Performance Table)
  const personalTasks = useMemo(() => {
    const list = analytics.taskBreakdown || [];
    return list.filter((t) => {
      if (personalStatusFilter !== 'ALL' && t.status !== personalStatusFilter) {
        return false;
      }
      if (personalSearchQuery.trim()) {
        const q = personalSearchQuery.toLowerCase();
        const matchTitle = t.title?.toLowerCase().includes(q);
        const matchType = t.type?.toLowerCase().includes(q);
        const matchProj = t.project_name?.toLowerCase().includes(q);
        return matchTitle || matchType || matchProj;
      }
      return true;
    });
  }, [analytics.taskBreakdown, personalStatusFilter, personalSearchQuery]);

  if (loading && !analyticsData) {
    return <AnalyticsSkeleton />;
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-rose-200 shadow-card text-center">
        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
        <h4 className="text-sm font-bold text-slate-800">Failed to load task analytics</h4>
        <p className="text-xs text-rose-600 mt-1">{error}</p>
        <button
          onClick={fetchAnalytics}
          className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  return (
    <div className="min-w-0 max-w-full">
      {/* UNIFIED TASK ANALYTICS CARD */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* 1. HEADER ROW: Left: icon, title, description. Right: Refresh button */}
        <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center shrink-0 mt-0.5">
              <Award className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                {isInternUser
                  ? 'Task Analytics & Performance'
                  : 'Task Analytics & Work Distribution'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {isInternUser
                  ? 'Real-time task status, workload, and individual performance metrics'
                  : 'Real-time status breakdowns, priority distribution, and velocity metrics from Supabase database'}
              </p>
            </div>
          </div>

          {/* Header Actions / Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Intern Two-Tab Switcher: Tab A (Tasks & Graphs) vs Tab B (Individual Performance) */}
            {isInternUser && (
              <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200/70 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setViewMode('TASKS')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    viewMode === 'TASKS'
                      ? 'bg-white text-purple-700 font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Tasks & Graphs</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('PERFORMANCE')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    viewMode === 'PERFORMANCE'
                      ? 'bg-white text-purple-700 font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Individual Performance</span>
                </button>
              </div>
            )}

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => fetchAnalytics(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold transition-colors cursor-pointer shadow-2xs disabled:opacity-60"
              title="Refresh current data"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isRefreshing ? 'animate-spin text-purple-600' : ''}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Divider below Header */}
        <div className="border-t border-slate-100" />

        {/* 2. FILTER ROW: Sprint (Scrum only), Date Range Filter, Reset, Scope */}
        <div className="px-4 py-3 sm:px-5 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Project Filter: Only rendered when outside a specific project context */}
            {!projectId && (
              <div className="inline-flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Project:</span>
                <select
                  value={selectedProjectId || ''}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 focus:outline-purple-500 cursor-pointer shadow-2xs"
                >
                  <option value="">{isInternUser ? 'All Assigned Projects (Aggregate)' : 'All Projects'}</option>
                  {accessibleProjects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Sprint Filter: Kept for Scrum projects; omitted for Kanban projects */}
            {!isKanban && accessibleSprints.length > 0 && (
              <div className="inline-flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sprint:</span>
                <select
                  value={selectedSprintId || 'ALL'}
                  onChange={(e) => setSelectedSprintId(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 focus:outline-purple-500 cursor-pointer shadow-2xs"
                >
                  <option value="ALL">All Sprints</option>
                  {accessibleSprints.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Date Range Filter: Retained for both Scrum and Kanban */}
            <div className="inline-flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date Range:</span>
              <select
                value={dateRangeFilter}
                onChange={(e) => setDateRangeFilter(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 focus:outline-purple-500 cursor-pointer shadow-2xs"
              >
                <option value="ALL">All Time</option>
                <option value="7D">Last 7 Days</option>
                <option value="14D">Last 14 Days</option>
                <option value="30D">Last 30 Days</option>
                <option value="THIS_MONTH">This Month</option>
              </select>
            </div>

            {/* Clear Filters Button: Shown when any filter differs from default */}
            {isFiltersChanged && (
              <button
                type="button"
                onClick={() => {
                  if (!projectId) setSelectedProjectId(defaultProjectId);
                  setSelectedSprintId(defaultSprintId);
                  setDateRangeFilter(defaultDateRange);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors cursor-pointer shadow-2xs ml-1"
                title="Reset filters to defaults"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>

          {/* Current Scope Badge */}
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0" />
            <span>
              {isInternUser ? (
                projectId || selectedProjectId ? (
                  <>
                    Project Scope: <strong className="text-slate-800">{project?.name || accessibleProjects.find((p) => p.id === (projectId || selectedProjectId))?.name || 'Selected Project'}</strong> ({analytics.total} {analytics.total === 1 ? 'task' : 'tasks'} assigned to you)
                  </>
                ) : (
                  <>
                    Aggregate Scope: <strong className="text-slate-800">All Assigned Projects</strong> ({analytics.total} {analytics.total === 1 ? 'task' : 'tasks'} assigned to you)
                  </>
                )
              ) : (
                <>
                  Project Scope (<strong className="text-slate-800">{analytics.total}</strong> {analytics.total === 1 ? 'task' : 'tasks'})
                </>
              )}
            </span>
          </div>
        </div>

        {/* Divider below Filter Row */}
        <div className="border-t border-slate-100" />

        {/* 3. TAB A: TASKS & GRAPHS VIEW */}
        {(viewMode === 'TASKS' || (!isInternUser && viewMode === 'BOTH')) && (
          <div>
            {/* KPI Row: 6 individual statistics metric blocks */}
            <div className="p-4 sm:p-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4">
                {/* 1. Tasks Assigned */}
                <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-2xs hover:shadow-xs hover:border-purple-200/80 transition-all flex flex-col justify-between min-h-[116px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Tasks Assigned</span>
                    <div className="w-7 h-7 rounded-lg bg-purple-100/80 text-purple-600 flex items-center justify-center">
                      <Layers className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-2">{analytics.total}</div>
                  <div className="text-xs text-slate-600 font-medium mt-1 truncate" title={`${analytics.inProgress} in progress · ${analytics.inReview} in review`}>
                    {analytics.inProgress} in progress · {analytics.inReview} in review
                  </div>
                </div>

                {/* 2. Completed */}
                <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-2xs hover:shadow-xs hover:border-purple-200/80 transition-all flex flex-col justify-between min-h-[116px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Completed</span>
                    <div className="w-7 h-7 rounded-lg bg-emerald-100/80 text-emerald-600 flex items-center justify-center">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-emerald-600 mt-2">{analytics.completed}</div>
                  <div className="text-xs text-slate-600 font-medium mt-1 truncate">
                    {analytics.completionRate}% completion rate
                  </div>
                </div>

                {/* 3. Completed On-Time Rate */}
                <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-2xs hover:shadow-xs hover:border-purple-200/80 transition-all flex flex-col justify-between min-h-[116px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">On-Time Rate</span>
                    <div className="w-7 h-7 rounded-lg bg-blue-100/80 text-blue-600 flex items-center justify-center">
                      <CalendarCheck className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-blue-600 mt-2">
                    {analytics.completedOnTimeRate !== null && analytics.completedOnTimeRate !== undefined
                      ? `${analytics.completedOnTimeRate}%`
                      : (analytics.onTimeRate !== null && analytics.onTimeRate !== undefined ? `${analytics.onTimeRate}%` : 'N/A')}
                  </div>
                  <div className="text-xs text-slate-600 font-medium mt-1 truncate">
                    {analytics.completedWithDueDateCount > 0
                      ? `${analytics.completedOnTime} of ${analytics.completedWithDueDateCount} on time`
                      : 'No items with deadlines'}
                  </div>
                </div>

                {/* 4. Overdue Items */}
                <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-2xs hover:shadow-xs hover:border-purple-200/80 transition-all flex flex-col justify-between min-h-[116px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Overdue Items</span>
                    <div className="w-7 h-7 rounded-lg bg-rose-100/80 text-rose-600 flex items-center justify-center">
                      <AlertTriangle className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div className={`text-2xl font-bold mt-2 ${analytics.pastDue > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                    {analytics.pastDue}
                  </div>
                  <div className="text-xs text-slate-600 font-medium mt-1 truncate">
                    {analytics.pastDue > 0
                      ? `${analytics.pastDue} overdue of ${analytics.scheduledItemsCount || 0}`
                      : '0 overdue items'}
                  </div>
                </div>

                {/* 5. Story Points */}
                <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-2xs hover:shadow-xs hover:border-purple-200/80 transition-all flex flex-col justify-between min-h-[116px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Story Points</span>
                    <div className="w-7 h-7 rounded-lg bg-indigo-100/80 text-indigo-600 flex items-center justify-center">
                      <CheckSquare className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-indigo-600 mt-2">
                    {analytics.storyPointsCompleted || 0}
                    <span className="text-xs font-semibold text-slate-400 ml-1">/ {analytics.storyPointsTotal || 0} pts</span>
                  </div>
                  <div className="text-xs text-slate-600 font-medium mt-1 truncate">
                    {analytics.storyPointsTotal > 0
                      ? `${Math.round(((analytics.storyPointsCompleted || 0) / analytics.storyPointsTotal) * 100)}% completed`
                      : 'No points estimated'}
                  </div>
                </div>

                {/* 6. Logged Effort */}
                <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-2xs hover:shadow-xs hover:border-purple-200/80 transition-all flex flex-col justify-between min-h-[116px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Logged Effort</span>
                    <div className="w-7 h-7 rounded-lg bg-amber-100/80 text-amber-600 flex items-center justify-center">
                      <Clock className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-amber-600 mt-2">
                    {analytics.totalLoggedHours || 0}
                    <span className="text-xs font-semibold text-slate-400 ml-1">hrs</span>
                  </div>
                  <div className="text-xs text-slate-600 font-medium mt-1 truncate">
                    {analytics.totalLoggedMinutes || 0}m actual effort
                  </div>
                </div>
              </div>
            </div>

            {/* Divider between KPI Row and Analytics Row */}
            <div className="border-t border-slate-100" />

            {/* Analytics Row: 42% Status Distribution (col-span-5) | 58% Priority Mix (col-span-7) with thin vertical divider */}
            {analytics.total === 0 ? (
              <div className="p-8 sm:p-12 text-center bg-slate-50/60 rounded-xl border border-dashed border-slate-200 m-4 sm:m-5">
                <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-3 border border-purple-100 shadow-2xs">
                  <FolderKanban className="w-6 h-6" />
                </div>
                {hasFullTeamAccess ? (
                  <>
                    <h4 className="text-base font-bold text-slate-900">
                      Nothing on the board just yet.
                    </h4>
                    <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
                      Tasks and deliverables for this project will appear here as your team starts adding work. You&apos;re all set to review project progress once work gets underway.
                    </p>
                    <button
                      type="button"
                      onClick={handleViewBoard}
                      className="mt-4 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer shadow-2xs transition-colors"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>View Project Board</span>
                    </button>
                  </>
                ) : (
                  <>
                    <h4 className="text-sm font-bold text-slate-800">
                      No tasks assigned to you in {project?.name || accessibleProjects.find((p) => p.id === (projectId || selectedProjectId))?.name || 'this project'}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      You currently have no tasks assigned to your account in this selected project.
                    </p>
                    <button
                      type="button"
                      onClick={handleViewBoard}
                      className="mt-4 px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>View Project Board</span>
                    </button>
                    {!projectId && selectedProjectId && (
                      <button
                        type="button"
                        onClick={() => setSelectedProjectId('')}
                        className="mt-2.5 block mx-auto text-xs font-medium text-slate-500 hover:text-purple-600"
                      >
                        View All Assigned Projects
                      </button>
                    )}
                  </>
                )}
              </div>
            ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
              {/* Left: Status Distribution (approx 42% on desktop) */}
              <div className="lg:col-span-5 p-5 sm:p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <PieChart className="w-4 h-4 text-purple-600" />
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Status Distribution</h3>
                    </div>
                    <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200/60">
                      Live Data
                    </span>
                  </div>

                  {/* Donut Chart Visual */}
                  <div className="my-5 flex flex-col sm:flex-row items-center justify-center gap-6">
                    <div className="relative flex items-center justify-center shrink-0">
                      <svg width={donutSize} height={donutSize} className="transform -rotate-90">
                        <circle
                          cx={donutSize / 2}
                          cy={donutSize / 2}
                          r={radius}
                          stroke="#F1F5F9"
                          strokeWidth={strokeWidth}
                          fill="transparent"
                        />
                        {donutSegments.map((seg) => (
                          <circle
                            key={seg.statusKey}
                            cx={donutSize / 2}
                            cy={donutSize / 2}
                            r={radius}
                            stroke={seg.config.color}
                            strokeWidth={strokeWidth}
                            strokeDasharray={seg.strokeDasharray}
                            strokeDashoffset={seg.strokeDashoffset}
                            fill="transparent"
                            strokeLinecap="round"
                            className="transition-all duration-500 hover:opacity-85"
                          />
                        ))}
                      </svg>

                      {/* Center metric */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className="text-2xl font-extrabold text-slate-900 leading-none">
                          {analytics.total}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
                          Items
                        </span>
                      </div>
                    </div>

                    {/* Status Legend */}
                    <div className="space-y-2 w-full max-w-[180px]">
                      {Object.entries(STATUS_CONFIG).map(([key, config]) => {
                        const count = analytics.statusCounts[key] || 0;
                        const pct = analytics.total > 0 ? Math.round((count / analytics.total) * 100) : 0;
                        return (
                          <div key={key} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <span 
                                className="w-2.5 h-2.5 rounded-full shrink-0" 
                                style={{ backgroundColor: config.color }} 
                              />
                              <span className="text-slate-600 truncate">{config.label}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 font-medium">
                              <span className="text-slate-800 font-bold">{count}</span>
                              <span className="text-slate-400 text-[10px]">({pct}%)</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Bottom Progress Bar */}
                <div className="pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
                    <span className="text-slate-500">Overall Progress</span>
                    <span className="text-purple-700 font-bold">{analytics.completionRate}% Done</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden flex">
                    {donutSegments.map(seg => (
                      <div
                        key={seg.statusKey}
                        style={{ 
                          width: `${seg.percentage}%`, 
                          backgroundColor: seg.config.color 
                        }}
                        className="h-full transition-all duration-300"
                        title={`${seg.config.label}: ${seg.count} (${Math.round(seg.percentage)}%)`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: Priority & Deliverable Mix (approx 58% on desktop) */}
              <div className="lg:col-span-7 p-5 sm:p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-purple-600" />
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Priority & Deliverable Mix</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      {analytics.pastDue > 0 && (
                        <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200/60 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          <span>{analytics.pastDue} Past Due</span>
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 font-medium">Categorized</span>
                    </div>
                  </div>

                  {/* Priority Breakdown Bars */}
                  <div className="mt-4 space-y-3">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Priority Volume
                    </span>
                    {Object.entries(PRIORITY_CONFIG).map(([key, config]) => {
                      const count = analytics.priorityCounts[key] || 0;
                      const pct = analytics.total > 0 ? (count / analytics.total) * 100 : 0;
                      return (
                        <div key={key} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-700">{config.label}</span>
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="font-bold text-slate-900">{count}</span>
                              <span className="text-slate-400 text-[10px]">({Math.round(pct)}%)</span>
                            </div>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${config.barClass}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Work-Item Types Grid */}
                  <div className="mt-5 pt-4 border-t border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-2.5">
                      Work-Item Types
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {Object.entries(TYPE_CONFIG).map(([typeKey, config]) => {
                        const count = analytics.typeCounts[typeKey] || 0;
                        return (
                          <div key={typeKey} className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-200/60 text-center">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{config.label}</div>
                            <div className="text-base font-extrabold text-slate-900 mt-1" style={{ color: config.color }}>
                              {count}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Scope & Database Sync Footer */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-purple-600" />
                    <span>
                      Scope: <strong>{isInternUser ? 'Your Personal Workload (Private)' : selectedPerformanceFilter === 'ALL' ? `All Members (${members.length})` : selectedPerformanceFilter === 'TECH_LEADS' ? `Tech Leads (${techLeadUserIds.size})` : (memberPerformanceMap.get(selectedPerformanceFilter)?.name || 'Selected User')}</strong>
                    </span>
                  </span>
                </div>
              </div>
            </div>
            )}
          </div>
        )}

        {/* 4. TAB B: INDIVIDUAL PERFORMANCE VIEW (For Intern) OR TEAM PERFORMANCE VIEW (For Manager) */}
        {(viewMode === 'PERFORMANCE' || (!isInternUser && viewMode === 'BOTH')) && (
          <div className="border-t border-slate-100 p-4 sm:p-5 space-y-4">
          {/* INTERN INDIVIDUAL PERFORMANCE DASHBOARD */}
          {isInternUser ? (
            <div className="space-y-4">
              {/* Performance Metrics Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* 1. Assigned Work Items & Points */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Your Assigned Work</div>
                  <div className="text-xl font-bold text-slate-900 mt-1">{analytics.total}</div>
                  <div className="text-[10px] text-purple-700 font-semibold mt-0.5">
                    {analytics.storyPointsTotal} story points assigned
                  </div>
                </div>

                {/* 2. Completion Progress */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Completion Progress</div>
                  <div className="text-xl font-bold text-purple-700 mt-1">{analytics.completionRate}%</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {analytics.completed} delivered ({analytics.inProgress} in progress)
                  </div>
                </div>

                {/* 3. Actual Work Time Logged */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Clock className="w-3 h-3 text-emerald-600" />
                    <span>Time Logged</span>
                  </div>
                  <div className="text-xl font-bold text-emerald-600 mt-1">
                    {analytics.totalLoggedHours > 0 ? `${analytics.totalLoggedHours}h` : `${analytics.totalLoggedMinutes}m`}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {analytics.completed > 0 && analytics.totalLoggedHours > 0 
                      ? `~${(analytics.totalLoggedHours / analytics.completed).toFixed(1)}h avg per task` 
                      : 'Recorded work entries'}
                  </div>
                </div>

                {/* 4. Delivery Accuracy */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Delivery Accuracy</div>
                  <div className="text-xl font-bold text-blue-600 mt-1">{analytics.onTimeRate}%</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {analytics.pastDue > 0 ? `${analytics.pastDue} overdue deadlines` : '100% on schedule'}
                  </div>
                </div>
              </div>

              {/* Status Breakdown & Workload Consistency Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Left Card: Workflow Pipeline State */}
                <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Workflow Pipeline State
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">Real-time Tasks</span>
                  </div>

                  <div className="space-y-2.5">
                    {[
                      { label: 'Completed', count: analytics.completed, color: 'bg-emerald-500', text: 'text-emerald-700' },
                      { label: 'In Progress', count: analytics.inProgress, color: 'bg-purple-600', text: 'text-purple-700' },
                      { label: 'In Review', count: analytics.inReview, color: 'bg-blue-500', text: 'text-blue-700' },
                      { label: 'To Do', count: analytics.todo, color: 'bg-slate-400', text: 'text-slate-600' },
                      { label: 'Blocked', count: analytics.blocked, color: 'bg-rose-500', text: 'text-rose-700' },
                    ].map((item) => {
                      const pct = analytics.total > 0 ? Math.round((item.count / analytics.total) * 100) : 0;
                      return (
                        <div key={item.label} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-700">{item.label}</span>
                            <span className="font-bold text-slate-900">{item.count} <span className="text-slate-400 font-normal">({pct}%)</span></span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-300 ${item.color}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right Card: Effort & Delivery Consistency */}
                <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Effort & Consistency
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        analytics.total === 0 
                          ? 'bg-slate-100 text-slate-600 border-slate-200' 
                          : analytics.onTimeRate >= 80 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {analytics.total === 0 ? 'No Work' : analytics.onTimeRate >= 80 ? 'On Track' : 'Needs Follow-Up'}
                      </span>
                    </div>

                    <div className="mt-3 space-y-3 text-xs">
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                        <span className="text-slate-600">Story Points Delivered</span>
                        <span className="font-bold text-purple-700">
                          {analytics.storyPointsCompleted} / {analytics.storyPointsTotal} pts
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                        <span className="text-slate-600">Recorded Work Time</span>
                        <span className="font-bold text-emerald-700">
                          {analytics.totalLoggedHours} hours ({analytics.totalLoggedMinutes}m)
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                        <span className="text-slate-600">Overdue Deliverables</span>
                        <span className={`font-bold ${analytics.pastDue > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                          {analytics.pastDue} {analytics.pastDue === 1 ? 'task' : 'tasks'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 italic pt-2 border-t border-slate-100">
                    Metrics reflect your individual contributions and recorded time entries.
                  </p>
                </div>
              </div>

              {/* Personal Task Delivery Record Table */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-purple-600" />
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Personal Task Delivery Record
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                      {personalTasks.length} {personalTasks.length === 1 ? 'Deliverable' : 'Deliverables'}
                    </span>
                  </div>

                  {/* Search and Status Filter for Personal Tasks */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={personalSearchQuery}
                        onChange={(e) => setPersonalSearchQuery(e.target.value)}
                        placeholder="Search your tasks..."
                        className="pl-7 pr-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg focus:outline-purple-500 w-44"
                      />
                    </div>

                    <select
                      value={personalStatusFilter}
                      onChange={(e) => setPersonalStatusFilter(e.target.value)}
                      className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-700 focus:outline-purple-500 cursor-pointer"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="IN_REVIEW">In Review</option>
                      <option value="TODO">To Do</option>
                      <option value="BLOCKED">Blocked</option>
                    </select>
                  </div>
                </div>

                {personalTasks.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-700">No assigned tasks match criteria</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Adjust your search or filter above to inspect your deliverables.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/80 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                        <tr>
                          <th className="py-3 px-4">Work Item</th>
                          <th className="py-3 px-3">Type</th>
                          <th className="py-3 px-3">Priority</th>
                          <th className="py-3 px-3">Status</th>
                          <th className="py-3 px-3">Due Date</th>
                          <th className="py-3 px-3 text-center">Points</th>
                          <th className="py-3 px-3 text-center">Time Logged</th>
                          <th className="py-3 px-4 text-right">Delivery</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                        {personalTasks.map((task) => {
                          const typeStyle = TYPE_CONFIG[task.type] || TYPE_CONFIG.TASK;
                          const priorityStyle = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.MEDIUM;
                          const statusStyle = STATUS_CONFIG[task.status] || STATUS_CONFIG.TODO;

                          return (
                            <tr key={task.id} className="hover:bg-slate-50/60 transition-colors">
                              {/* Title & Project */}
                              <td className="py-3 px-4 max-w-xs">
                                <div className="font-bold text-slate-900 truncate" title={task.title}>
                                  {task.title}
                                </div>
                                {task.project_name && (
                                  <div className="text-[10px] text-slate-400 truncate mt-0.5">
                                    {task.project_name}
                                  </div>
                                )}
                              </td>

                              {/* Type Badge */}
                              <td className="py-3 px-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border inline-block ${typeStyle.badgeClass}`}>
                                  {typeStyle.label}
                                </span>
                              </td>

                              {/* Priority Badge */}
                              <td className="py-3 px-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border inline-block ${priorityStyle.badgeClass}`}>
                                  {priorityStyle.label}
                                </span>
                              </td>

                              {/* Status Badge */}
                              <td className="py-3 px-3">
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border inline-block ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                                  {statusStyle.label}
                                </span>
                              </td>

                              {/* Due Date & On-Time Status */}
                              <td className="py-3 px-3 whitespace-nowrap">
                                {task.due_date ? (
                                  <div className="space-y-0.5">
                                    <div className="text-xs text-slate-800">
                                      {new Date(task.due_date).toLocaleDateString()}
                                    </div>
                                    {task.is_past_due ? (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                        Overdue
                                      </span>
                                    ) : task.status === 'COMPLETED' ? (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        On-Time
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-slate-400">Scheduled</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-300 text-xs">—</span>
                                )}
                              </td>

                              {/* Story Points */}
                              <td className="py-3 px-3 text-center font-bold text-slate-900">
                                {task.story_points || '—'}
                              </td>

                              {/* Time Logged */}
                              <td className="py-3 px-3 text-center">
                                {task.logged_hours > 0 ? (
                                  <span className="font-bold text-emerald-700">
                                    {task.logged_hours}h
                                  </span>
                                ) : task.logged_minutes > 0 ? (
                                  <span className="font-semibold text-emerald-700">
                                    {task.logged_minutes}m
                                  </span>
                                ) : (
                                  <span className="text-slate-300">0h</span>
                                )}
                              </td>

                              {/* Delivery Progress Bar */}
                              <td className="py-3 px-4 text-right">
                                {task.status === 'COMPLETED' ? (
                                  <span className="text-emerald-600 font-bold text-xs inline-flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Done</span>
                                  </span>
                                ) : (
                                  <div className="flex items-center justify-end gap-1.5">
                                    <span className="text-[10px] text-slate-400 font-medium">In Flow</span>
                                    <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                      <div 
                                        className={`h-full ${task.status === 'IN_PROGRESS' ? 'bg-purple-600 w-1/2' : task.status === 'IN_REVIEW' ? 'bg-blue-600 w-3/4' : 'bg-slate-300 w-1/6'}`} 
                                      />
                                    </div>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* MANAGER TEAM PERFORMANCE TABLE (Unchanged for Manager view) */
            <div className="space-y-3">
              {/* Performance Summary Metrics Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Members Tracked</div>
                  <div className="text-xl font-bold text-slate-900 mt-1">{performanceRows.length}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{techLeadUserIds.size} tech leads</div>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Completion Rate</div>
                  <div className="text-xl font-bold text-purple-700 mt-1">
                    {performanceRows.length > 0 
                      ? Math.round(performanceRows.reduce((acc, r) => acc + r.completionRate, 0) / performanceRows.length)
                      : 0}%
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Across active assignees</div>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Completed</div>
                  <div className="text-xl font-bold text-emerald-600 mt-1">
                    {performanceRows.reduce((acc, r) => acc + r.completed, 0)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Tasks delivered</div>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Past Due Items</div>
                  <div className="text-xl font-bold text-rose-600 mt-1">
                    {performanceRows.reduce((acc, r) => acc + r.pastDue, 0)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Requires follow-up</div>
                </div>
              </div>

              {/* Members Table */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-purple-600" />
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      {selectedPerformanceFilter === 'TECH_LEADS'
                        ? 'Tech Leads Performance & Task Delivery'
                        : selectedPerformanceFilter !== 'ALL'
                        ? `${memberPerformanceMap.get(selectedPerformanceFilter)?.name || 'Member'} — Task Performance Record`
                        : 'Team Members & Tech Leads Performance Directory'}
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                      {performanceRows.length} Tracked
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Tasks Completed · Assigned · Past Due · On-Time Delivery
                  </div>
                </div>

                {performanceRows.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-700">No members matching current scope</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Switch dropdown filter above to view performance</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/80 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                        <tr>
                          <th className="py-3 px-4">Member / Tech Lead</th>
                          <th className="py-3 px-3">Role</th>
                          <th className="py-3 px-3 text-center">Assigned</th>
                          <th className="py-3 px-3 text-center">Completed</th>
                          <th className="py-3 px-3 text-center">Active Work</th>
                          <th className="py-3 px-3 text-center">Past Due</th>
                          <th className="py-3 px-3 text-center">On-Time</th>
                          <th className="py-3 px-4 text-right">Completion Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                        {performanceRows.map((mem) => {
                          const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(mem.name)}&background=random`;
                          const activeCount = mem.inProgress + mem.inReview;
                          return (
                            <tr 
                              key={mem.userId}
                              onClick={() => setSelectedPerformanceFilter(mem.userId === selectedPerformanceFilter ? 'ALL' : mem.userId)}
                              className={`hover:bg-purple-50/40 transition-colors cursor-pointer ${
                                selectedPerformanceFilter === mem.userId ? 'bg-purple-50/60 font-semibold' : ''
                              }`}
                              title="Click to filter charts by this member"
                            >
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2.5">
                                  <img 
                                    src={avatar} 
                                    alt={mem.name} 
                                    className="w-7 h-7 rounded-full object-cover ring-1 ring-slate-200 shrink-0" 
                                  />
                                  <div className="min-w-0">
                                    <div className="font-bold text-slate-900 truncate">{mem.name}</div>
                                    {mem.email && <div className="text-[10px] text-slate-400 truncate">{mem.email}</div>}
                                  </div>
                                </div>
                              </td>

                              <td className="py-3 px-3">
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border inline-block whitespace-nowrap ${
                                  mem.isTechLead
                                    ? 'bg-purple-100 text-purple-800 border-purple-200'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}>
                                  {mem.roleLabel}
                                </span>
                              </td>

                              <td className="py-3 px-3 text-center font-bold text-slate-900">
                                {mem.totalAssigned}
                              </td>

                              <td className="py-3 px-3 text-center">
                                <span className="font-bold text-emerald-600">{mem.completed}</span>
                              </td>

                              <td className="py-3 px-3 text-center">
                                {activeCount > 0 ? (
                                  <span className="font-semibold text-blue-600">{activeCount}</span>
                                ) : (
                                  <span className="text-slate-300">0</span>
                                )}
                              </td>

                              <td className="py-3 px-3 text-center">
                                {mem.pastDue > 0 ? (
                                  <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 font-bold border border-rose-200">
                                    {mem.pastDue}
                                  </span>
                                ) : (
                                  <span className="text-slate-300">0</span>
                                )}
                              </td>

                              <td className="py-3 px-3 text-center font-semibold">
                                {mem.completed > 0 ? (
                                  <span className={mem.onTimeRate >= 80 ? 'text-emerald-600' : 'text-amber-600'}>
                                    {mem.onTimeRate}%
                                  </span>
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>

                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-purple-600 rounded-full transition-all duration-300"
                                      style={{ width: `${mem.completionRate}%` }}
                                    />
                                  </div>
                                  <span className="font-bold text-purple-700 text-xs w-9 text-right">
                                    {mem.completionRate}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
