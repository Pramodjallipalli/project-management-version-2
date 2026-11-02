import React, { useState, useEffect, useCallback } from 'react';
import { 
  Building2, 
  Users, 
  FolderKanban, 
  Plus, 
  Search, 
  Loader2, 
  ChevronRight,
  ChevronLeft,
  Edit2,
  Ban,
  CheckCircle,
  ShieldAlert,
  UserPlus,
  CheckCircle2,
  RefreshCw,
  ArrowUpRight,
  KeyRound,
  MoreVertical,
  Check,
  AlertCircle,
  Bug,
  Clock,
  ShieldCheck
} from 'lucide-react';
import { organizationService } from '../../../services/organization.service';
import CreateOrganizationModal from '../components/CreateOrganizationModal';
import OrganizationInspectModal from '../components/OrganizationInspectModal';

export default function SuperAdminDashboardView({ onNavigateTab }) {
  // Platform Overview state
  const [overview, setOverview] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Directory state
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [inspectOrgId, setInspectOrgId] = useState(null);

  // Success notification
  const [successMessage, setSuccessMessage] = useState('');

  // Organization Rename modal
  const [editingOrg, setEditingOrg] = useState(null);
  const [newName, setNewName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  // Active quick action dropdown menu
  const [openActionMenuId, setOpenActionMenuId] = useState(null);

  // Fetch Platform Overview KPIs & Activity
  const fetchOverview = useCallback(async () => {
    try {
      setLoadingOverview(true);
      const data = await organizationService.getPlatformOverview();
      setOverview(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load platform overview:', err);
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  // Fetch Organizations Directory
  const fetchOrganizations = useCallback(async (
    targetPage = page,
    searchQuery = search,
    status = statusFilter,
    sort = sortBy,
    order = sortOrder,
    limit = pageSize
  ) => {
    try {
      setLoading(true);
      const res = await organizationService.getOrganizations({
        search: searchQuery.trim() || undefined,
        status: status !== 'all' ? status : undefined,
        sortBy: sort,
        sortOrder: order,
        page: targetPage,
        limit,
      });

      setOrganizations(res.organizations || []);
      setPage(res.pagination?.page || 1);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotalCount(res.pagination?.total || 0);
    } catch (err) {
      console.error('Failed to load organizations:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, sortBy, sortOrder, pageSize]);

  // Initial load
  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  // Debounced directory search & filter triggers
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchOrganizations(1, search, statusFilter, sortBy, sortOrder, pageSize);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, statusFilter, sortBy, sortOrder, pageSize, fetchOrganizations]);

  // Close open dropdown menu on click outside
  useEffect(() => {
    const handleClickOutside = () => setOpenActionMenuId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const handleManualRefresh = () => {
    fetchOverview();
    fetchOrganizations(page, search, statusFilter, sortBy, sortOrder, pageSize);
  };

  const handleToggleStatus = async (org, e) => {
    e?.stopPropagation();
    setOpenActionMenuId(null);
    const actionLabel = org.is_active ? 'suspend' : 'reactivate';
    if (!window.confirm(`Are you sure you want to ${actionLabel} "${org.name}"?`)) {
      return;
    }

    try {
      await organizationService.toggleStatus(org.id, !org.is_active);
      fetchOrganizations(page, search, statusFilter, sortBy, sortOrder, pageSize);
      fetchOverview();
      showNotification(`Organization "${org.name}" successfully ${org.is_active ? 'suspended' : 'reactivated'}.`);
    } catch (err) {
      alert(err.message || `Failed to ${actionLabel} organization`);
    }
  };

  const handleSaveRename = async (e) => {
    e.preventDefault();
    if (!newName.trim() || !editingOrg) return;

    try {
      setIsRenaming(true);
      await organizationService.updateOrganization(editingOrg.id, { name: newName.trim() });
      setEditingOrg(null);
      fetchOrganizations(page, search, statusFilter, sortBy, sortOrder, pageSize);
      fetchOverview();
      showNotification('Organization name updated successfully.');
    } catch (err) {
      alert(err.message || 'Failed to rename organization');
    } finally {
      setIsRenaming(false);
    }
  };

  const showNotification = (msg) => {
    setSuccessMessage(msg);
    setTimeout(() => {
      setSuccessMessage('');
    }, 4000);
  };

  const handleCreateSuccess = (newOrg) => {
    fetchOrganizations(1, '', 'all', sortBy, sortOrder, pageSize);
    fetchOverview();
    showNotification(`Organization "${newOrg?.name || 'New Organization'}" provisioned successfully.`);
  };

  const formatLastUpdated = (date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatEventDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getEventIcon = (action) => {
    if (action.includes('ORGANIZATION')) {
      return (
        <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
          <Building2 className="w-4 h-4" />
        </div>
      );
    }
    if (action.includes('PASSWORD')) {
      return (
        <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
          <KeyRound className="w-4 h-4" />
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
        <Users className="w-4 h-4" />
      </div>
    );
  };

  const formatEventTitle = (action) => {
    switch (action) {
      case 'ORGANIZATION_CREATED':
        return 'Organization created';
      case 'ORGANIZATION_UPDATED':
        return 'Organization renamed';
      case 'ORGANIZATION_SUSPENDED':
        return 'Organization suspended';
      case 'ORGANIZATION_REACTIVATED':
        return 'Organization reactivated';
      case 'MANAGER_PROVISIONED':
        return 'Manager created';
      case 'MANAGERS_BULK_IMPORTED':
        return 'Managers bulk imported';
      case 'MANAGER_PASSWORD_RESET':
        return 'Manager password reset';
      default:
        return action.replace(/_/g, ' ').toLowerCase();
    }
  };

  const formatEventDetail = (event) => {
    const meta = event.metadata || {};
    if (meta.organizationName) {
      return `${meta.organizationName} (ID: ${event.targetId?.slice(0, 8)}...)`;
    }
    if (meta.managerName && meta.managerEmail) {
      return `${meta.managerName} (${meta.managerEmail})`;
    }
    if (meta.totalRows) {
      return `Imported ${meta.createdCount} managers (${meta.skippedCount} skipped)`;
    }
    return event.targetId ? `Target ID: ${event.targetId.slice(0, 8)}...` : '';
  };

  // Donut chart calculations
  const totalOrgs = overview?.statusDistribution?.total || 0;
  const activeOrgs = overview?.statusDistribution?.active || 0;
  const suspendedOrgs = overview?.statusDistribution?.suspended || 0;
  const activePercent = overview?.statusDistribution?.activePercentage ?? 100;
  const suspendedPercent = overview?.statusDistribution?.suspendedPercentage ?? 0;

  // SVG circular donut values
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const activeStroke = (activePercent / 100) * circumference;
  const suspendedStroke = (suspendedPercent / 100) * circumference;

  return (
    <div className="space-y-6">
      {/* Success Notification Banner */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage('')}
            className="text-emerald-600 hover:text-emerald-800 text-xs font-bold p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* SECTION 1: Platform Overview */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Platform Overview</h2>
            <p className="text-xs text-slate-500 mt-0.5">Key metrics across all organizations in InternHub</p>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200/80">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Live data</span>
            </span>

            <span className="text-xs text-slate-400 font-medium">
              Last updated: {formatLastUpdated(lastUpdated)}
            </span>

            <button
              onClick={handleManualRefresh}
              title="Refresh platform statistics"
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingOverview ? 'animate-spin text-purple-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* 4 KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Organizations */}
          <div className="p-4 rounded-2xl border border-slate-200/80 bg-white hover:border-purple-200 transition-all flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">Total Organizations</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">
                {overview?.kpis?.totalOrganizations ?? (loadingOverview ? '-' : 0)}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Registered organizations</p>
            </div>
          </div>

          {/* Card 2: Total Managers */}
          <div className="p-4 rounded-2xl border border-slate-200/80 bg-white hover:border-emerald-200 transition-all flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">Total Managers</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">
                {overview?.kpis?.totalManagers ?? (loadingOverview ? '-' : 0)}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Across all organizations</p>
            </div>
          </div>

          {/* Card 3: Total Users */}
          <div className="p-4 rounded-2xl border border-slate-200/80 bg-white hover:border-blue-200 transition-all flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                <span>Total Users</span>
                <span title="All tenant members across organizations, excluding Super Admin accounts" className="text-slate-400 cursor-help">ⓘ</span>
              </p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">
                {overview?.kpis?.totalUsers ?? (loadingOverview ? '-' : 0)}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">All tenant members</p>
            </div>
          </div>

          {/* Card 4: Total Projects */}
          <div className="p-4 rounded-2xl border border-slate-200/80 bg-white hover:border-amber-200 transition-all flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
              <FolderKanban className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">Total Projects</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">
                {overview?.kpis?.totalProjects ?? (loadingOverview ? '-' : 0)}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Across all organizations</p>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION: Bug Management & QA Retest Portal Monitoring */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
              <Bug className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                DAILOQA Bug Management & QA Retest Overview
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time defect lifecycle, intake triage queue, and verification health across all projects
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200/80">
            System Defect Telemetry
          </span>
        </div>

        {/* 4 Defect Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50">
            <p className="text-xs font-semibold text-slate-500">Reported Complaints</p>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {overview?.bugPortalSummary?.totalComplaints ?? (loadingOverview ? '-' : 0)}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Total complaints submitted</p>
          </div>

          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/30">
            <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Pending QA Review</span>
            </p>
            <p className="text-2xl font-black text-amber-900 mt-1">
              {overview?.bugPortalSummary?.pendingReview ?? (loadingOverview ? '-' : 0)}
            </p>
            <p className="text-[11px] text-amber-600/80 mt-0.5">Awaiting QA verification gate</p>
          </div>

          <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/30">
            <p className="text-xs font-semibold text-rose-700 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Active Official Bugs</span>
            </p>
            <p className="text-2xl font-black text-rose-900 mt-1">
              {overview?.bugPortalSummary?.activeBugs ?? (loadingOverview ? '-' : 0)}
            </p>
            <p className="text-[11px] text-rose-600/80 mt-0.5">Verified & in development</p>
          </div>

          <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/30">
            <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Closed & Passed Retest</span>
            </p>
            <p className="text-2xl font-black text-emerald-900 mt-1">
              {overview?.bugPortalSummary?.closedBugs ?? (loadingOverview ? '-' : 0)}
            </p>
            <p className="text-[11px] text-emerald-600/80 mt-0.5">Verified passed by QA</p>
          </div>
        </div>

        {/* Project Roles Distribution Chips */}
        {overview?.rolesSummary?.projectRoleDistribution?.length > 0 && (
          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700">
                Active Project Role Assignments ({overview?.rolesSummary?.totalProjectRoles || 0} total across projects)
              </span>
              <span className="text-[11px] text-slate-400">Multi-Role Enabled</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {overview.rolesSummary.projectRoleDistribution.map((roleItem) => (
                <div
                  key={roleItem.role_name}
                  className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                  <span>{roleItem.role_name.replace(/_/g, ' ')}:</span>
                  <strong className="text-slate-900 font-bold">{roleItem.count}</strong>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: Organization Status & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel 1: Organization Status */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Organization Status</h3>
            <p className="text-xs text-slate-500 mt-0.5">Distribution of organization states</p>
          </div>

          <div className="py-6 flex items-center justify-center gap-10">
            {/* Donut Chart */}
            <div className="relative w-36 h-36 flex items-center justify-center shrink-0">
              <svg className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
                {/* Background Ring */}
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  className="stroke-slate-100"
                  strokeWidth="14"
                  fill="transparent"
                />
                {/* Active Stroke */}
                {activeStroke > 0 && (
                  <circle
                    cx="60"
                    cy="60"
                    r={radius}
                    stroke="#10B981"
                    strokeWidth="14"
                    fill="transparent"
                    strokeDasharray={`${activeStroke} ${circumference}`}
                    strokeLinecap="round"
                    className="transition-all duration-500"
                  />
                )}
                {/* Suspended Stroke */}
                {suspendedStroke > 0 && (
                  <circle
                    cx="60"
                    cy="60"
                    r={radius}
                    stroke="#F43F5E"
                    strokeWidth="14"
                    fill="transparent"
                    strokeDasharray={`${suspendedStroke} ${circumference}`}
                    strokeDashoffset={-activeStroke}
                    strokeLinecap="round"
                    className="transition-all duration-500"
                  />
                )}
              </svg>

              {/* Inside Center Text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-black text-slate-900">{totalOrgs}</span>
                <span className="text-xs text-slate-400 font-medium">Total</span>
              </div>
            </div>

            {/* Status Legend */}
            <div className="space-y-3 min-w-[160px]">
              <button
                onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
                className={`w-full flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer ${
                  statusFilter === 'active' ? 'bg-emerald-50 ring-1 ring-emerald-300' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  <span className="text-xs font-semibold text-slate-700">Active</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-900">{activeOrgs}</span>
                  <span className="text-xs text-slate-400 w-9 text-right">{activePercent}%</span>
                </div>
              </button>

              <button
                onClick={() => setStatusFilter(statusFilter === 'suspended' ? 'all' : 'suspended')}
                className={`w-full flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer ${
                  statusFilter === 'suspended' ? 'bg-rose-50 ring-1 ring-rose-300' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                  <span className="text-xs font-semibold text-slate-700">Suspended</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-900">{suspendedOrgs}</span>
                  <span className="text-xs text-slate-400 w-9 text-right">{suspendedPercent}%</span>
                </div>
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400 text-center">
            Click an item above to filter the directory table
          </div>
        </div>

        {/* Panel 2: Recent Activity */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Recent Activity</h3>
              <p className="text-xs text-slate-500 mt-0.5">Latest administrative actions across the platform</p>
            </div>

            <button
              onClick={() => onNavigateTab?.('audit-logs')}
              className="text-xs font-bold text-purple-600 hover:text-purple-700 inline-flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>View All Logs</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Activity List */}
          <div className="py-2 space-y-3 flex-1 min-h-[160px] flex flex-col justify-center">
            {!overview?.recentActivity || overview.recentActivity.length === 0 ? (
              <div className="text-center text-slate-400 text-xs py-8">
                No recent administrative activity recorded yet.
              </div>
            ) : (
              overview.recentActivity.slice(0, 4).map((evt) => (
                <div key={evt.id} className="flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    {getEventIcon(evt.action)}
                    <div className="truncate">
                      <p className="font-bold text-slate-800 truncate">{formatEventTitle(evt.action)}</p>
                      <p className="text-[11px] text-slate-500 truncate">{formatEventDetail(evt)}</p>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400 shrink-0 font-medium">
                    {formatEventDate(evt.created_at)}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Audit trail security verified</span>
            <span>Real-time platform logs</span>
          </div>
        </div>
      </div>

      {/* SECTION 3: Tenant Organizations Directory */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Tenant Organizations Directory</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Provision, inspect, manage managers, and configure tenancy lifecycles across the platform
            </p>
          </div>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-sm hover:shadow transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Provision Organization</span>
          </button>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          {/* Search Input */}
          <div className="relative w-full sm:flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search organizations, managers, or IDs..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-purple-600 focus:outline-none transition-colors"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-purple-600 font-semibold text-slate-700 shadow-2xs cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>

            {/* Sort Filter */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-purple-600 font-semibold text-slate-700 shadow-2xs cursor-pointer"
            >
              <option value="created_at">Sort by: Created Date</option>
              <option value="name">Sort by: Name</option>
              <option value="users">Sort by: Users Count</option>
              <option value="projects">Sort by: Projects Count</option>
            </select>

            {/* Page Size Filter */}
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="px-3 py-2 text-xs rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-purple-600 font-semibold text-slate-700 shadow-2xs cursor-pointer"
            >
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
            </select>
          </div>
        </div>

        {/* Directory Table */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
              <span className="text-xs font-medium">Loading platform organizations...</span>
            </div>
          ) : organizations.length === 0 ? (
            <div className="p-16 text-center text-slate-400">
              <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="font-bold text-slate-700 text-sm">No Organizations Found</p>
              <p className="text-xs text-slate-400 mt-0.5">Click "Provision Organization" to onboard a new tenant</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold tracking-wider uppercase text-[10px]">
                    <th className="py-3 px-5">Organization ↕</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Managers</th>
                    <th className="py-3 px-4">Users</th>
                    <th className="py-3 px-4">Projects</th>
                    <th className="py-3 px-4">Created Date ↕</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {organizations.map((org) => {
                    const managers = org.managers || [];
                    const primaryMgr = managers[0];
                    return (
                      <tr key={org.id} className="hover:bg-purple-50/40 transition-colors">
                        {/* 1. Organization Column */}
                        <td className="py-3.5 px-5 font-bold text-slate-900">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs shrink-0">
                              {org.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="block text-slate-900 font-bold truncate">{org.name}</span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingOrg(org);
                                    setNewName(org.name);
                                  }}
                                  title="Rename organization"
                                  className="text-slate-400 hover:text-purple-600 transition-colors p-0.5"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono">{org.id.slice(0, 8)}...</span>
                            </div>
                          </div>
                        </td>

                        {/* 2. Status Column */}
                        <td className="py-3.5 px-4">
                          {org.is_active ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle className="w-3 h-3" />
                              <span>Active</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <Ban className="w-3 h-3" />
                              <span>Suspended</span>
                            </span>
                          )}
                        </td>

                        {/* 3. Managers Column */}
                        <td className="py-3.5 px-4">
                          {primaryMgr ? (
                            <div>
                              <span className="font-bold text-slate-800">{managers.length}</span>
                              <span className="block text-[11px] font-medium text-purple-700 hover:underline cursor-pointer" onClick={() => setInspectOrgId(org.id)}>
                                {primaryMgr.name}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-400 italic text-[11px]">No managers assigned</span>
                              <button
                                onClick={() => setInspectOrgId(org.id)}
                                className="px-1.5 py-0.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded text-[10px] font-bold cursor-pointer transition-colors"
                              >
                                + Add
                              </button>
                            </div>
                          )}
                        </td>

                        {/* 4. Users Column */}
                        <td className="py-3.5 px-4 font-semibold text-slate-700">
                          <span className="px-2.5 py-1 bg-slate-100 rounded-md font-mono text-[11px]">
                            {org.stats?.user_count || 0}
                          </span>
                        </td>

                        {/* 5. Projects Column */}
                        <td className="py-3.5 px-4 font-semibold text-slate-700">
                          <span className="px-2.5 py-1 bg-slate-100 rounded-md font-mono text-[11px]">
                            {org.stats?.project_count || 0}
                          </span>
                        </td>

                        {/* 6. Created Date Column */}
                        <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                          {new Date(org.created_at).toLocaleDateString()}
                        </td>

                        {/* 7. Actions Column */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={(e) => handleToggleStatus(org, e)}
                              title={org.is_active ? 'Suspend organization' : 'Reactivate organization'}
                              className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                                org.is_active
                                  ? 'bg-white hover:bg-rose-50 border-rose-200 text-rose-700'
                                  : 'bg-white hover:bg-emerald-50 border-emerald-200 text-emerald-700'
                              }`}
                            >
                              {org.is_active ? 'Suspend' : 'Reactivate'}
                            </button>

                            <button
                              onClick={() => setInspectOrgId(org.id)}
                              className="px-3 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer inline-flex items-center gap-1"
                            >
                              <span>Inspect</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>

                            {/* 3-dots Quick Action Menu */}
                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenActionMenuId(openActionMenuId === org.id ? null : org.id);
                                }}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>

                              {openActionMenuId === org.id && (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="absolute right-0 top-full mt-1 w-36 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 text-left animate-in fade-in zoom-in-95"
                                >
                                  <button
                                    onClick={() => {
                                      setOpenActionMenuId(null);
                                      setInspectOrgId(org.id);
                                    }}
                                    className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 font-medium text-left"
                                  >
                                    View Details
                                  </button>
                                  <button
                                    onClick={() => {
                                      setOpenActionMenuId(null);
                                      setEditingOrg(org);
                                      setNewName(org.name);
                                    }}
                                    className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 font-medium text-left"
                                  >
                                    Rename Org
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Directory Footer & Pagination */}
          <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 bg-slate-50/50">
            <span className="text-xs text-slate-500">
              Showing {organizations.length > 0 ? (page - 1) * pageSize + 1 : 0} to {Math.min(page * pageSize, totalCount)} of {totalCount} organizations
            </span>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  disabled={page <= 1}
                  onClick={() => fetchOrganizations(page - 1, search, statusFilter, sortBy, sortOrder, pageSize)}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <span className="px-2.5 py-1 text-xs font-bold text-purple-700 bg-purple-50 rounded-lg border border-purple-200">
                  {page}
                </span>

                <button
                  disabled={page >= totalPages}
                  onClick={() => fetchOrganizations(page + 1, search, statusFilter, sortBy, sortOrder, pageSize)}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Inspect Modal Component */}
      <OrganizationInspectModal
        isOpen={!!inspectOrgId}
        orgId={inspectOrgId}
        onClose={() => setInspectOrgId(null)}
        onOrganizationUpdated={() => {
          fetchOrganizations(page, search, statusFilter, sortBy, sortOrder, pageSize);
          fetchOverview();
        }}
      />

      {/* Create Organization Modal */}
      <CreateOrganizationModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      {/* Rename Organization Modal */}
      {editingOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">Rename Organization</h3>
            <form onSubmit={handleSaveRename} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Organization Name</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-purple-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingOrg(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRenaming || !newName.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
                >
                  {isRenaming ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
