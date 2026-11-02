import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Building2, 
  LogOut, 
  ShieldCheck, 
  LayoutDashboard,
  Bell,
  Search,
  Sparkles,
  FileText
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import SuperAdminDashboardView from './views/SuperAdminDashboardView';
import SuperAdminAuditLogsView from './views/SuperAdminAuditLogsView';

export default function SuperAdminApp() {
  const { user: authUser, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const getTabFromPath = (path) => {
    if (path.includes('audit-logs')) return 'audit-logs';
    return 'organizations';
  };

  const [currentTab, setCurrentTab] = useState(() => getTabFromPath(location.pathname));

  useEffect(() => {
    const tab = getTabFromPath(location.pathname);
    setCurrentTab(tab);
  }, [location.pathname]);

  const handleTabChange = (tabId) => {
    setCurrentTab(tabId);
    navigate(`/super-admin/${tabId}`);
  };

  const displayName = authUser?.name || 'Super Admin';
  const displayEmail = authUser?.email || 'superadmin@dailoqa.com';
  const userAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=4C1D95&color=fff`;

  return (
    <div className="flex h-screen bg-[#F6F7FB] font-sans antialiased text-slate-800 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-[#2E1065] text-slate-200 flex flex-col justify-between shrink-0 select-none border-r border-purple-900/50">
        <div>
          {/* Brand */}
          <div className="h-16 flex items-center gap-3 px-5 border-b border-purple-800/40 bg-purple-950/40">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-500 border border-purple-400/40 flex items-center justify-center text-white font-black text-sm tracking-wider shadow-sm">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
                SUPER ADMIN
              </span>
              <span className="text-[10px] font-mono tracking-wider text-purple-300/70">
                Control Plane v1.0
              </span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="p-3 space-y-1">
            <button
              onClick={() => handleTabChange('organizations')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                currentTab === 'organizations'
                  ? 'bg-purple-600/90 text-white shadow-sm'
                  : 'text-purple-200/80 hover:bg-purple-900/50 hover:text-white'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Organizations</span>
            </button>

            <button
              onClick={() => handleTabChange('audit-logs')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                currentTab === 'audit-logs'
                  ? 'bg-purple-600/90 text-white shadow-sm'
                  : 'text-purple-200/80 hover:bg-purple-900/50 hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Audit Logs</span>
            </button>
          </nav>
        </div>

        {/* User Footer */}
        <div className="p-3 border-t border-purple-800/40 bg-purple-950/30">
          <div className="flex items-center justify-between p-2 rounded-xl bg-purple-900/40 border border-purple-800/40">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-purple-800 text-white font-bold text-xs flex items-center justify-center shrink-0 border border-purple-700">
                GA
              </div>
              <div className="truncate">
                <span className="block text-xs font-bold text-white truncate">Global Super Admin</span>
                <span className="block text-[10px] text-purple-300/70 truncate">{displayEmail}</span>
              </div>
            </div>
            <button
              onClick={logout}
              title="Logout"
              className="p-1.5 text-purple-300/80 hover:text-rose-400 hover:bg-purple-950/60 rounded-lg transition-colors cursor-pointer shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-18 bg-white border-b border-slate-200/80 px-8 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-base font-bold text-slate-900 tracking-tight">Platform Control Center</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                Global Root
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Manage organizations, users, and platform operations across InternHub</p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 font-medium">Logged in as {displayEmail}</span>
            <button
              onClick={logout}
              className="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* Scrollable View Area */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto">
            {currentTab === 'organizations' && <SuperAdminDashboardView onNavigateTab={handleTabChange} />}
            {currentTab === 'audit-logs' && <SuperAdminAuditLogsView />}
          </div>
        </main>
      </div>
    </div>
  );
}
