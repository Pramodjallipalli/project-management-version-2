import React, { useState, useEffect, useMemo } from 'react';
import { FolderKanban, AlertCircle, ShieldCheck } from 'lucide-react';
import ProjectOverviewTab from './ProjectOverviewTab';
import ProjectRoadmapTab from './ProjectRoadmapTab';
import ProjectSprintWorkspaceTab from './ProjectSprintWorkspaceTab';
import ProjectCycleWorkspaceTab from './ProjectCycleWorkspaceTab';
import ProjectBacklogTab from './ProjectBacklogTab';
import KanbanBoard from '../../kanban/KanbanBoard';
import ProjectMomTab from './ProjectMomTab';
import ProjectApprovalsTab from './ProjectApprovalsTab';
import ProjectBugsTab from './ProjectBugsTab';
import { projectsService } from '../../../services/projects.service';
import { useAuth } from '../../../context/AuthContext';
import { getProjectMethodology, getProjectTabs, isKanbanProject } from '../../../utils/methodology';
import ProjectMethodologyBadge from './ProjectMethodologyBadge';
import { PROJECT_ROLE_LABELS } from '../../modals/AssignProjectRolesModal';

export default function ProjectWorkspaceView({ 
  projectId,
  onBackToDirectory, 
  activeTab = 'overview', 
  onTabChange,
  onOpenSearch,
  onActionTrigger,
  onToast,
  onProjectLoaded,
  readOnly = false,
  userRole = null,
  isIntern = false,
}) {
  const { user: authUser } = useAuth();
  const currentUserId = authUser?.id || authUser?.user_id;
  const authRole = String(authUser?.role?.name || authUser?.role || authUser?.type || authUser?.user_type || '').toUpperCase();
  const isInternUser = isIntern || authRole === 'INTERN';

  const [currentTab, setCurrentTab] = useState(activeTab);
  const [liveProject, setLiveProject] = useState(null);
  const [selectedSprintId, setSelectedSprintId] = useState(null);

  const isTechLeadOnProject = 
    authRole === 'TECH_LEAD' || 
    Boolean(authUser?.is_tech_lead && (authUser?.lead_project_ids?.includes(projectId) || !authUser?.lead_project_ids?.length)) ||
    (liveProject?.members || []).some((m) => 
      (m.user_id === currentUserId || m.id === currentUserId) && 
      (m.project_role === 'TECH_LEAD' || m.role === 'TECH_LEAD')
    );

  const isProjectOwner = 
    authUser?.id === liveProject?.owner_id ||
    (Array.isArray(liveProject?.owner_ids) && liveProject.owner_ids.includes(authUser?.id)) ||
    (Array.isArray(liveProject?.owners) && liveProject.owners.some((o) => o.id === authUser?.id));

  const canManageProject = 
    authRole === 'MANAGER' || 
    authRole === 'ADMIN' || 
    authRole === 'SUPER_ADMIN' || 
    isProjectOwner ||
    isTechLeadOnProject;

  const effectiveReadOnly = readOnly && !canManageProject;

  useEffect(() => {
    if (projectId) {
      projectsService.getProjectById(projectId)
        .then((proj) => {
          setLiveProject(proj);
          onProjectLoaded?.(proj);
        })
        .catch((err) => console.error('Failed to load project details in workspace:', err));
    }
  }, [projectId]);

  const isKanban = isKanbanProject(liveProject);
  const tabs = useMemo(() => {
    return getProjectTabs(liveProject, { isIntern: isInternUser });
  }, [liveProject, isInternUser]);

  // If intern is somehow on approvals tab, redirect to overview
  useEffect(() => {
    if (isInternUser && currentTab === 'approvals') {
      setCurrentTab('overview');
      onTabChange?.('overview');
    }
  }, [isInternUser, currentTab, onTabChange]);

  // Adjust active tab when switching between Scrum and Kanban projects
  useEffect(() => {
    if (liveProject) {
      if (isKanban && (currentTab === 'scrum' || currentTab === 'sprint' || currentTab === 'cycles')) {
        const targetTab = 'kanban';
        setCurrentTab(targetTab);
        onTabChange?.(targetTab);
      } else if (!isKanban && (currentTab === 'kanban' || currentTab === 'cycles')) {
        const targetTab = currentTab === 'kanban' ? 'scrum' : 'sprint';
        setCurrentTab(targetTab);
        onTabChange?.(targetTab);
      }
    }
  }, [isKanban, liveProject, currentTab, onTabChange]);

  useEffect(() => {
    setCurrentTab(activeTab);
  }, [activeTab]);

  const handleTabClick = (tabId) => {
    setCurrentTab(tabId);
    onTabChange?.(tabId);
  };

  useEffect(() => {
    const handleCustomTabChange = (e) => {
      if (e?.detail?.tab) {
        handleTabClick(e.detail.tab);
      }
    };
    window.addEventListener('project-tab-change', handleCustomTabChange);
    return () => window.removeEventListener('project-tab-change', handleCustomTabChange);
  }, []);

  const handleOpenSprintBoard = (sprintId) => {
    if (isKanban) return;
    setSelectedSprintId(sprintId);
    handleTabClick('sprint');
  };

  const ownerNames = (Array.isArray(liveProject?.owners) && liveProject.owners.length > 0)
    ? liveProject.owners.map((o) => o.name || o.email).join(', ')
    : (liveProject?.owner ? (liveProject.owner.name || liveProject.owner.email) : (liveProject ? 'Unassigned' : 'Loading...'));

  const memberCount = liveProject?._count?.members ?? (liveProject?.members?.length ?? 0);
  const statusStr = liveProject?.status || 'PLANNED';

  // Resolve current logged-in user's project membership and role(s)
  const currentMember = useMemo(() => {
    return (liveProject?.members || []).find((m) => {
      const uid = m.user_id || m.user?.id || m.id;
      return uid === currentUserId;
    });
  }, [liveProject, currentUserId]);

  const assignedProjectRoles = useMemo(() => {
    if (!currentMember) return [];
    if (Array.isArray(currentMember.member_roles) && currentMember.member_roles.length > 0) {
      return currentMember.member_roles.map((mr) => mr.role_name || mr.name);
    }
    if (Array.isArray(currentMember.project_roles) && currentMember.project_roles.length > 0) {
      return currentMember.project_roles;
    }
    if (currentMember.project_role && currentMember.project_role.trim()) {
      return [currentMember.project_role.trim()];
    }
    return [];
  }, [currentMember]);

  const roleDisplayInfo = useMemo(() => {
    if (assignedProjectRoles.length === 0) {
      return {
        text: 'Your assigned role: Not Assigned',
        isUnassigned: true,
      };
    }
    const formatted = assignedProjectRoles.map(
      (r) => PROJECT_ROLE_LABELS[r] || r.replace(/_/g, ' ')
    );
    if (formatted.length === 1) {
      return {
        text: `Your assigned role: ${formatted[0]}`,
        isUnassigned: false,
      };
    }
    return {
      text: `Your assigned roles: ${formatted.join(', ')}`,
      isUnassigned: false,
    };
  }, [assignedProjectRoles]);

  return (
    <div className="min-w-0 max-w-full">
      {/* PROJECT CONTEXT: METADATA & PROJECT NAVIGATION TABS */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-200 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-3 pb-0 select-none shadow-xs">
        {/* ROW 1: Project Metadata */}
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 text-xs sm:text-sm text-slate-600 pb-2.5">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {liveProject?.name && (
              <>
                <span className="font-bold text-slate-900">{liveProject.name}</span>
                <ProjectMethodologyBadge methodology={liveProject.methodology} />
                <span className="text-slate-300 select-none">·</span>
              </>
            )}
            <span>Project {Array.isArray(liveProject?.owners) && liveProject.owners.length > 1 ? 'Owners' : 'Owner'}: <strong className="text-slate-800 font-semibold">{ownerNames}</strong></span>
            <span className="text-slate-300 select-none">·</span>
            <span>Status: <strong className="text-purple-700 font-semibold">{statusStr}</strong></span>
            <span className="text-slate-300 select-none">·</span>
            <span><strong className="text-slate-800 font-semibold">{memberCount}</strong> {memberCount === 1 ? 'Member' : 'Members'}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border shadow-2xs transition-all ${
                roleDisplayInfo.isUnassigned
                  ? 'bg-slate-50 text-slate-500 border-slate-200'
                  : 'bg-purple-50 text-purple-700 border-purple-200 ring-1 ring-purple-100'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
              <span>{roleDisplayInfo.text}</span>
            </div>

            {effectiveReadOnly && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                Contributor View (Read-Only)
              </span>
            )}
          </div>
        </div>

        {/* ROW 2: Project Navigation Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto -mb-px min-w-0 max-w-full">
          {tabs.map((tab) => {
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 cursor-pointer ${
                  isActive
                    ? 'border-purple-600 text-purple-700 font-bold'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Render Current Tab Content */}
      <div className="pt-2 sm:pt-2.5">
        {currentTab === 'overview' ? (
          <ProjectOverviewTab 
            projectId={projectId} 
            project={liveProject}
            onNavigateTab={handleTabClick} 
            onToast={onToast}
            onDeleted={onBackToDirectory}
            readOnly={effectiveReadOnly}
          />
        ) : currentTab === 'roadmap' ? (
          <ProjectRoadmapTab
            projectId={projectId}
            project={liveProject}
            onOpenSprintBoard={handleOpenSprintBoard}
            onToast={onToast}
            readOnly={effectiveReadOnly}
          />
        ) : (!isKanban && (currentTab === 'sprint' || currentTab === 'cycles')) ? (
          <ProjectSprintWorkspaceTab
            projectId={projectId}
            selectedSprintId={selectedSprintId}
            onBackToRoadmap={() => handleTabClick('roadmap')}
            onToast={onToast}
            readOnly={effectiveReadOnly}
          />
        ) : currentTab === 'backlog' ? (
          <ProjectBacklogTab
            projectId={projectId}
            project={liveProject}
            isKanbanProject={isKanban}
            onToast={onToast}
            readOnly={effectiveReadOnly}
          />
        ) : currentTab === 'scrum' || currentTab === 'kanban' ? (
          <KanbanBoard
            projectId={projectId}
            project={liveProject}
            isKanbanProject={isKanban}
            onToast={onToast}
            readOnly={effectiveReadOnly}
          />
        ) : currentTab === 'action-items' || currentTab === 'mom' ? (
          <ProjectMomTab
            projectId={projectId}
            projectName={liveProject?.name}
            onToast={onToast}
            readOnly={effectiveReadOnly}
          />
        ) : currentTab === 'bugs' ? (
          <ProjectBugsTab
            projectId={projectId}
            projectName={liveProject?.name}
            project={liveProject}
            onToast={onToast}
            readOnly={effectiveReadOnly}
          />
        ) : (currentTab === 'approvals' && !isInternUser) ? (
          <ProjectApprovalsTab
            projectId={projectId}
            project={liveProject}
            onToast={onToast}
            readOnly={effectiveReadOnly}
          />
        ) : (
          <div className="bg-white rounded-2xl p-12 border border-slate-200/80 shadow-xs text-center max-w-lg mx-auto my-8">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-3">
              <FolderKanban className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              {tabs.find((t) => t.id === currentTab)?.label || 'Module'}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto mb-4">
              Action Items module is active.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
