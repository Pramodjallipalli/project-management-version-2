import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, ShieldCheck, ShieldPlus, Loader2, Users, AlertCircle, Check } from 'lucide-react';
import { projectsService } from '../../services/projects.service';
import AddCustomRoleModal from './AddCustomRoleModal';

export const PROJECT_ROLES = [
  { value: '', label: 'Not Assigned' },
  { value: 'BUSINESS_ANALYST', label: 'Business Analyst' },
  { value: 'DEVELOPER', label: 'Developer' },
  { value: 'DEVOPS_ENGINEER', label: 'DevOps Engineer' },
  { value: 'EMPLOYEE', label: 'Employee' },
  { value: 'INTERN', label: 'Intern' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'PROJECT_COORDINATOR', label: 'Project Coordinator' },
  { value: 'QA_TESTER', label: 'QA Tester' },
  { value: 'TECH_LEAD', label: 'Tech Lead' },
  { value: 'UI_UX_DESIGNER', label: 'UI/UX Designer' },
];

export const PROJECT_ROLE_LABELS = {
  BUSINESS_ANALYST: 'Business Analyst',
  DEVELOPER: 'Developer',
  DEVOPS_ENGINEER: 'DevOps Engineer',
  EMPLOYEE: 'Employee',
  INTERN: 'Intern',
  MANAGER: 'Manager',
  PROJECT_COORDINATOR: 'Project Coordinator',
  QA_TESTER: 'QA Tester',
  TECH_LEAD: 'Tech Lead',
  UI_UX_DESIGNER: 'UI/UX Designer',
};

export default function AssignProjectRolesModal({
  isOpen,
  onClose,
  projectId,
  projectName = '',
  members = [],
  onSuccess,
  onToast,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleMap, setRoleMap] = useState({});
  const [projectRoles, setProjectRoles] = useState([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [isAddCustomRoleOpen, setIsAddCustomRoleOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchRoles = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoadingRoles(true);
      const roles = await projectsService.getProjectRoles(projectId);
      setProjectRoles(Array.isArray(roles) ? roles : []);
    } catch (err) {
      console.warn('Could not fetch custom roles, using defaults:', err);
    } finally {
      setLoadingRoles(false);
    }
  }, [projectId]);

  // Sync roleMap and fetch roles whenever modal opens
  useEffect(() => {
    if (isOpen) {
      const initialMap = {};
      members.forEach((m) => {
        const uid = m.user_id || m.user?.id || m.id;
        if (uid) {
          if (Array.isArray(m.project_roles) && m.project_roles.length > 0) {
            initialMap[uid] = [...m.project_roles];
          } else if (Array.isArray(m.member_roles) && m.member_roles.length > 0) {
            initialMap[uid] = m.member_roles.map((mr) => mr.role_name);
          } else if (m.project_role && m.project_role.trim()) {
            initialMap[uid] = [m.project_role.trim()];
          } else {
            initialMap[uid] = [];
          }
        }
      });
      setRoleMap(initialMap);
      setSearchQuery('');
      setError('');
      fetchRoles();
    }
  }, [isOpen, members, fetchRoles]);

  const standardRoles = useMemo(() => {
    if (!projectRoles.length) {
      return PROJECT_ROLES.filter((r) => r.value);
    }
    return projectRoles
      .filter((r) => !r.is_custom && r.name !== 'ADMIN' && r.name !== 'SUPER_ADMIN')
      .map((r) => ({
        value: r.name,
        label: r.label || PROJECT_ROLE_LABELS[r.name] || r.name,
      }));
  }, [projectRoles]);

  const customRoles = useMemo(() => {
    return projectRoles
      .filter((r) => r.is_custom)
      .map((r) => ({
        value: r.name,
        label: r.label || r.name,
        description: r.description,
      }));
  }, [projectRoles]);

  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = q ? members.filter((m) => {
      const name = (m.name || m.user?.name || '').toLowerCase();
      const email = (m.email || m.user?.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    }) : [...members];

    return list.sort((a, b) => {
      const aRoles = roleMap[a.user_id] || a.project_roles || (a.project_role ? [a.project_role] : []);
      const bRoles = roleMap[b.user_id] || b.project_roles || (b.project_role ? [b.project_role] : []);
      const aIsLead = aRoles.includes('TECH_LEAD');
      const bIsLead = bRoles.includes('TECH_LEAD');
      if (aIsLead && !bIsLead) return -1;
      if (!aIsLead && bIsLead) return 1;
      const nameA = a.name || a.user?.name || a.email || '';
      const nameB = b.name || b.user?.name || b.email || '';
      return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
    });
  }, [members, searchQuery, roleMap]);

  if (!isOpen) return null;

  const handleAddRole = (userId, newRole) => {
    if (!newRole) return;
    setRoleMap((prev) => {
      const current = prev[userId] || [];
      if (current.includes(newRole)) return prev;
      return {
        ...prev,
        [userId]: [...current, newRole],
      };
    });
  };

  const handleRemoveRole = (userId, roleToRemove) => {
    setRoleMap((prev) => {
      const current = prev[userId] || [];
      return {
        ...prev,
        [userId]: current.filter((r) => r !== roleToRemove),
      };
    });
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!projectId) return;

    setSaving(true);
    setError('');

    try {
      const roleAssignments = members.map((m) => {
        const uid = m.user_id || m.user?.id || m.id;
        const assignedRoles = roleMap[uid] || [];
        return {
          user_id: uid,
          project_roles: assignedRoles,
          project_role: assignedRoles[0] || null,
        };
      });

      const updatedMembers = await projectsService.updateMemberRoles(projectId, roleAssignments);
      onSuccess?.(updatedMembers);
      onClose();
    } catch (err) {
      console.error('Failed to update project roles:', err);
      setError(err?.response?.data?.error || err.message || 'Failed to update member roles');
    } finally {
      setSaving(false);
    }
  };

  const modalContent = (
    <div 
      className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Assign Project Member Roles
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Assign project-specific roles to members of {projectName ? <span className="font-semibold text-slate-700">"{projectName}"</span> : 'this project'}.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAddCustomRoleOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold border border-purple-200 transition-colors cursor-pointer shadow-2xs"
            >
              <ShieldPlus className="w-3.5 h-3.5" />
              <span>Add Custom Role</span>
            </button>
            <button
              onClick={onClose}
              disabled={saving}
              className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors disabled:opacity-50 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search bar inside Role Assignment Panel */}
        <div className="p-4 border-b border-slate-100 bg-white shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search project members by name or email..."
              className="w-full pl-9 pr-9 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-semibold"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-5 mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium flex items-start gap-2.5 shrink-0">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Members List */}
        <div className="p-5 overflow-y-auto flex-1 divide-y divide-slate-100">
          {members.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700">No Project Members</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                There are no members assigned to this project yet.
              </p>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="py-10 text-center">
              <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-600">No members match "{searchQuery}"</p>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="mt-2 text-xs text-purple-600 font-bold hover:underline"
              >
                Clear search filter
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredMembers.map((member) => {
                const uid = member.user_id || member.user?.id || member.id;
                const mName = member.name || member.user?.name || member.email || 'Member';
                const mEmail = member.email || member.user?.email || '';
                const mAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(mName)}&background=random`;
                const assignedRoles = roleMap[uid] || [];

                return (
                  <div
                    key={uid}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-50/70 hover:bg-slate-50 border border-slate-200/60 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={mAvatar}
                        alt={mName}
                        className="w-9 h-9 rounded-full object-cover ring-1 ring-slate-200 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {mName}
                        </div>
                        {mEmail && (
                          <div className="text-[11px] text-slate-400 truncate">
                            {mEmail}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 self-start sm:self-center shrink-0">
                      {/* Assigned Role Tags */}
                      <div className="flex flex-wrap items-center gap-1.5 max-w-xs">
                        {assignedRoles.length === 0 ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                            Not Assigned
                          </span>
                        ) : (
                          assignedRoles.map((roleKey) => (
                            <span
                              key={roleKey}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs"
                            >
                              <span>{PROJECT_ROLE_LABELS[roleKey] || roleKey.replace(/_/g, ' ')}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveRole(uid, roleKey)}
                                disabled={saving}
                                className="text-purple-400 hover:text-purple-700 hover:bg-purple-100 rounded-sm p-0.5 cursor-pointer"
                                title={`Remove ${PROJECT_ROLE_LABELS[roleKey] || roleKey}`}
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </span>
                          ))
                        )}
                      </div>

                      {/* Add Role Dropdown */}
                      <div className="relative shrink-0">
                        <label htmlFor={`role-add-${uid}`} className="sr-only">
                          Add Role for {mName}
                        </label>
                        <select
                          id={`role-add-${uid}`}
                          value=""
                          onChange={(e) => {
                            if (e.target.value) {
                              handleAddRole(uid, e.target.value);
                            }
                          }}
                          disabled={saving}
                          className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-purple-200 rounded-lg text-purple-700 hover:bg-purple-50 focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all cursor-pointer shadow-2xs"
                        >
                          <option value="" disabled>+ Add Role...</option>
                          {customRoles.filter((r) => !assignedRoles.includes(r.value)).length > 0 && (
                            <optgroup label="Custom Project Roles">
                              {customRoles
                                .filter((r) => !assignedRoles.includes(r.value))
                                .map((role) => (
                                  <option key={role.value} value={role.value}>
                                    {role.label}
                                  </option>
                                ))}
                            </optgroup>
                          )}
                          <optgroup label="Standard Roles">
                            {standardRoles
                              .filter((r) => !assignedRoles.includes(r.value))
                              .map((role) => (
                                <option key={role.value} value={role.value}>
                                  {role.label}
                                </option>
                              ))}
                          </optgroup>
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 font-medium">
            {members.length} {members.length === 1 ? 'member' : 'members'} in project
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || members.length === 0}
              className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 active:bg-purple-800 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Roles</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>

      {isAddCustomRoleOpen && (
        <AddCustomRoleModal
          isOpen={isAddCustomRoleOpen}
          onClose={() => setIsAddCustomRoleOpen(false)}
          projectId={projectId}
          projectName={projectName}
          onRoleCreated={(newRole) => {
            fetchRoles();
            onToast?.({
              type: 'success',
              title: 'Custom Role Available',
              message: `Role "${newRole.name}" is now available to assign.`,
            });
          }}
          onToast={onToast}
        />
      )}
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}

