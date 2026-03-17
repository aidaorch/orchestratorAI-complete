import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Zap, FileText, Activity, Search, Trash2, ShieldCheck,
  ShieldOff, UserCheck, UserX, RefreshCw, ChevronLeft, ChevronRight,
  Key, AlertCircle, CheckCircle2, Loader2, BarChart2, Shield, Code2
} from 'lucide-react';
import { adminService, AdminStats, AdminUser, AdminWorkflow, AdminTemplate } from '../services/adminService';

type AdminTab = 'overview' | 'users' | 'workflows' | 'templates' | 'apidocs';

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

const fmtTime = (d: string | null) =>
  d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never';

// ── Stat Card ─────────────────────────────────────────────────────────────────
const StatCard: React.FC<{ label: string; value: number; icon: React.ReactNode; color: string }> = ({ label, value, icon, color }) => (
  <div className={`bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4`}>
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>{icon}</div>
    <div>
      <div className="text-2xl font-bold text-slate-800">{value.toLocaleString()}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  </div>
);

// ── Pagination ────────────────────────────────────────────────────────────────
const Pagination: React.FC<{ page: number; pages: number; total: number; onPage: (p: number) => void }> = ({ page, pages, total, onPage }) => (
  <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
    <span>{total} total</span>
    <div className="flex items-center gap-2">
      <button onClick={() => onPage(page - 1)} disabled={page <= 1}
        className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition-colors">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="text-xs font-medium">Page {page} of {pages || 1}</span>
      <button onClick={() => onPage(page + 1)} disabled={page >= pages}
        className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition-colors">
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  </div>
);

// ── Toast ─────────────────────────────────────────────────────────────────────
const Toast: React.FC<{ msg: { type: 'ok' | 'err'; text: string } | null }> = ({ msg }) => {
  if (!msg) return null;
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium
      ${msg.type === 'ok' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
      {msg.type === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      {msg.text}
    </div>
  );
};

// ── Reset Password Modal ──────────────────────────────────────────────────────
const ResetPasswordModal: React.FC<{
  user: AdminUser;
  onClose: () => void;
  onReset: (userId: string, pw: string) => Promise<void>;
}> = ({ user, onClose, onReset }) => {
  const [pw, setPw] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if (pw.length < 8) return;
    setLoading(true);
    await onReset(user.user_id, pw);
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="font-bold text-slate-800 mb-1">Reset Password</h3>
        <p className="text-sm text-slate-500 mb-4">Set a new password for <span className="font-semibold">@{user.username}</span></p>
        <input
          type="password" value={pw} onChange={e => setPw(e.target.value)}
          placeholder="New password (min 8 chars)"
          className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-aida-teal mb-4"
          autoFocus
        />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={handle} disabled={pw.length < 8 || loading}
            className="flex-1 py-2 bg-aida-teal text-white rounded-xl text-sm font-medium hover:bg-aida-dark disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
            Reset
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Overview Tab ──────────────────────────────────────────────────────────────
const OverviewTab: React.FC<{ stats: AdminStats | null; loading: boolean }> = ({ stats, loading }) => {
  if (loading) return <div className="flex items-center justify-center h-48"><Loader2 className="w-8 h-8 animate-spin text-aida-teal" /></div>;
  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={stats.total_users} icon={<Users className="w-6 h-6 text-aida-teal" />} color="bg-aida-light" />
        <StatCard label="Active Users" value={stats.active_users} icon={<UserCheck className="w-6 h-6 text-emerald-600" />} color="bg-emerald-50" />
        <StatCard label="New This Week" value={stats.new_users_this_week} icon={<Activity className="w-6 h-6 text-aida-teal" />} color="bg-aida-light" />
        <StatCard label="Admin Users" value={stats.admin_users} icon={<Shield className="w-6 h-6 text-amber-600" />} color="bg-amber-50" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Workflows" value={stats.total_workflows} icon={<Zap className="w-6 h-6 text-blue-600" />} color="bg-blue-50" />
        <StatCard label="Total Templates" value={stats.total_templates} icon={<FileText className="w-6 h-6 text-teal-600" />} color="bg-teal-50" />
        <StatCard label="Total Executions" value={stats.total_executions} icon={<BarChart2 className="w-6 h-6 text-rose-600" />} color="bg-rose-50" />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <h3 className="font-semibold text-slate-700 mb-3 text-sm">Platform Health</h3>
        <div className="space-y-2">
          {[
            { label: 'API', status: 'Operational' },
            { label: 'Database', status: 'Operational' },
            { label: 'AI Service', status: 'Operational' },
          ].map(s => (
            <div key={s.label} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
              <span className="text-sm text-slate-600">{s.label}</span>
              <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                <span className="w-2 h-2 bg-emerald-500 rounded-full" />{s.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Users Tab ─────────────────────────────────────────────────────────────────
const UsersTab: React.FC<{ onToast: (msg: { type: 'ok' | 'err'; text: string }) => void }> = ({ onToast }) => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);

  const load = useCallback(async (p = page, s = search) => {
    setLoading(true);
    try {
      const res = await adminService.getUsers(p, s);
      setUsers(res.users);
      setTotal(res.total);
      setPages(res.pages);
    } catch { onToast({ type: 'err', text: 'Failed to load users' }); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { load(1, search); setPage(1); }, [search]);
  useEffect(() => { load(page, search); }, [page]);

  const toggle = async (user: AdminUser, field: 'is_active' | 'is_admin') => {
    try {
      await adminService.updateUser(user.user_id, { [field]: !user[field] });
      onToast({ type: 'ok', text: 'User updated' });
      load(page, search);
    } catch (e: any) {
      onToast({ type: 'err', text: e.response?.data?.detail || 'Failed to update user' });
    }
  };

  const del = async (user: AdminUser) => {
    if (!confirm(`Delete user @${user.username}? This cannot be undone.`)) return;
    try {
      await adminService.deleteUser(user.user_id);
      onToast({ type: 'ok', text: `@${user.username} deleted` });
      load(page, search);
    } catch (e: any) {
      onToast({ type: 'err', text: e.response?.data?.detail || 'Failed to delete user' });
    }
  };

  const handleReset = async (userId: string, pw: string) => {
    try {
      await adminService.resetPassword(userId, pw);
      onToast({ type: 'ok', text: 'Password reset successfully' });
    } catch (e: any) {
      onToast({ type: 'err', text: e.response?.data?.detail || 'Failed to reset password' });
    }
  };

  return (
    <div>
      {resetTarget && <ResetPasswordModal user={resetTarget} onClose={() => setResetTarget(null)} onReset={handleReset} />}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users…"
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-aida-teal" />
        </div>
        <button onClick={() => load(page, search)} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
          <RefreshCw className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs text-slate-500 font-semibold uppercase tracking-wider">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3 hidden md:table-cell">Joined</th>
                <th className="px-4 py-3 hidden sm:table-cell">Last Login</th>
                <th className="px-4 py-3 text-center">WF</th>
                <th className="px-4 py-3 text-center">TPL</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Admin</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={8} className="text-center py-10 text-slate-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-slate-400">No users found</td></tr>
              ) : users.map(u => (
                <tr key={u.user_id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-800">@{u.username}</div>
                    <div className="text-xs text-slate-400 truncate max-w-[160px]">{u.email}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell">{fmt(u.created_at)}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs hidden sm:table-cell">{fmtTime(u.last_login)}</td>
                  <td className="px-4 py-3 text-center text-slate-600 font-mono text-xs">{u.workflow_count}</td>
                  <td className="px-4 py-3 text-center text-slate-600 font-mono text-xs">{u.template_count}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => toggle(u, 'is_active')} title={u.is_active ? 'Deactivate' : 'Activate'}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors
                        ${u.is_active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}>
                      {u.is_active ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                      {u.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => toggle(u, 'is_admin')} title={u.is_admin ? 'Remove admin' : 'Make admin'}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors
                        ${u.is_admin ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                      {u.is_admin ? <ShieldCheck className="w-3 h-3" /> : <ShieldOff className="w-3 h-3" />}
                      {u.is_admin ? 'Admin' : 'User'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setResetTarget(u)} title="Reset password"
                        className="p-1.5 rounded-lg hover:bg-aida-light text-slate-400 hover:text-aida-teal transition-colors">
                        <Key className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => del(u)} title="Delete user"
                        className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination page={page} pages={pages} total={total} onPage={setPage} />
    </div>
  );
};

// ── Workflows Tab ─────────────────────────────────────────────────────────────
const WorkflowsTab: React.FC<{ onToast: (msg: { type: 'ok' | 'err'; text: string }) => void }> = ({ onToast }) => {
  const [items, setItems] = useState<AdminWorkflow[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (p = page, s = search) => {
    setLoading(true);
    try {
      const res = await adminService.getWorkflows(p, s);
      setItems(res.workflows);
      setTotal(res.total);
      setPages(res.pages);
    } catch { onToast({ type: 'err', text: 'Failed to load workflows' }); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { load(1, search); setPage(1); }, [search]);
  useEffect(() => { load(page, search); }, [page]);

  const del = async (wf: AdminWorkflow) => {
    if (!confirm(`Delete workflow "${wf.workflow_name}"?`)) return;
    try {
      await adminService.deleteWorkflow(wf.workflow_id);
      onToast({ type: 'ok', text: 'Workflow deleted' });
      load(page, search);
    } catch { onToast({ type: 'err', text: 'Failed to delete workflow' }); }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search workflows…"
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-aida-teal" />
        </div>
        <button onClick={() => load(page, search)} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
          <RefreshCw className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs text-slate-500 font-semibold uppercase tracking-wider">
                <th className="px-4 py-3">Workflow</th>
                <th className="px-4 py-3 hidden sm:table-cell">Owner</th>
                <th className="px-4 py-3 text-center hidden md:table-cell">Steps</th>
                <th className="px-4 py-3 hidden lg:table-cell">Prompt</th>
                <th className="px-4 py-3 hidden md:table-cell">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" /></td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-slate-400">No workflows found</td></tr>
              ) : items.map(wf => (
                <tr key={wf.workflow_id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800 max-w-[180px] truncate">{wf.workflow_name}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs hidden sm:table-cell">@{wf.username}</td>
                  <td className="px-4 py-3 text-center text-slate-600 font-mono text-xs hidden md:table-cell">{wf.step_count ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell max-w-[200px] truncate">{wf.original_prompt || '—'}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell">{fmt(wf.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => del(wf)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination page={page} pages={pages} total={total} onPage={setPage} />
    </div>
  );
};

// ── Templates Tab ─────────────────────────────────────────────────────────────
const TemplatesTab: React.FC<{ onToast: (msg: { type: 'ok' | 'err'; text: string }) => void }> = ({ onToast }) => {
  const [items, setItems] = useState<AdminTemplate[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (p = page, s = search) => {
    setLoading(true);
    try {
      const res = await adminService.getTemplates(p, s);
      setItems(res.templates);
      setTotal(res.total);
      setPages(res.pages);
    } catch { onToast({ type: 'err', text: 'Failed to load templates' }); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { load(1, search); setPage(1); }, [search]);
  useEffect(() => { load(page, search); }, [page]);

  const del = async (tpl: AdminTemplate) => {
    if (!confirm(`Delete template "${tpl.name}"?`)) return;
    try {
      await adminService.deleteTemplate(tpl.template_id);
      onToast({ type: 'ok', text: 'Template deleted' });
      load(page, search);
    } catch { onToast({ type: 'err', text: 'Failed to delete template' }); }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search templates…"
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-aida-teal" />
        </div>
        <button onClick={() => load(page, search)} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
          <RefreshCw className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs text-slate-500 font-semibold uppercase tracking-wider">
                <th className="px-4 py-3">Template</th>
                <th className="px-4 py-3 hidden sm:table-cell">Owner</th>
                <th className="px-4 py-3 text-center hidden md:table-cell">Steps</th>
                <th className="px-4 py-3 text-center hidden md:table-cell">Uses</th>
                <th className="px-4 py-3 text-center hidden sm:table-cell">Visibility</th>
                <th className="px-4 py-3 hidden md:table-cell">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" /></td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-slate-400">No templates found</td></tr>
              ) : items.map(tpl => (
                <tr key={tpl.template_id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800 max-w-[180px] truncate">{tpl.name}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs hidden sm:table-cell">@{tpl.username}</td>
                  <td className="px-4 py-3 text-center text-slate-600 font-mono text-xs hidden md:table-cell">{tpl.step_count}</td>
                  <td className="px-4 py-3 text-center text-slate-600 font-mono text-xs hidden md:table-cell">{tpl.usage_count}</td>
                  <td className="px-4 py-3 text-center hidden sm:table-cell">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tpl.is_public ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {tpl.is_public ? 'Public' : 'Private'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell">{fmt(tpl.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => del(tpl)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination page={page} pages={pages} total={total} onPage={setPage} />
    </div>

  );
};

// ── Main AdminPage ────────────────────────────────────────────────────────────
const AdminPage: React.FC = () => {
  const [tab, setTab] = useState<AdminTab>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const showToast = (msg: { type: 'ok' | 'err'; text: string }) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    adminService.getStats()
      .then(setStats)
      .catch(() => showToast({ type: 'err', text: 'Failed to load stats' }))
      .finally(() => setStatsLoading(false));
  }, []);

  const TABS: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <BarChart2 className="w-4 h-4" /> },
    { id: 'users', label: 'Users', icon: <Users className="w-4 h-4" /> },
    { id: 'workflows', label: 'Workflows', icon: <Zap className="w-4 h-4" /> },
    { id: 'templates', label: 'Templates', icon: <FileText className="w-4 h-4" /> },
    { id: 'apidocs', label: 'API Docs', icon: <Code2 className="w-4 h-4" /> },
  ];

  return (
    <div className="h-full overflow-auto bg-slate-50">
      <Toast msg={toast} />

      {/* Header */}
      <div className="bg-gradient-to-r from-aida-dark to-[#005560] text-white px-4 sm:px-8 py-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <Shield className="w-6 h-6 text-aida-mint" />
            <h1 className="text-xl font-bold">Admin Panel</h1>
          </div>
          <p className="text-slate-400 text-sm">Manage users, content, and platform settings</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-8">
        <div className="max-w-6xl mx-auto flex gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                ${tab === t.id ? 'border-aida-teal text-aida-teal' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6">
        {tab === 'overview' && <OverviewTab stats={stats} loading={statsLoading} />}
        {tab === 'users' && <UsersTab onToast={showToast} />}
        {tab === 'workflows' && <WorkflowsTab onToast={showToast} />}
        {tab === 'templates' && <TemplatesTab onToast={showToast} />}
        {tab === 'apidocs' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden" style={{ height: 'calc(100vh - 220px)' }}>
            <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
              <Code2 className="w-4 h-4 text-aida-teal" />
              <span className="text-sm font-medium text-slate-700">Swagger UI — Interactive API Documentation</span>
              <a
                href="/api/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-xs text-aida-teal hover:underline"
              >
                Open in new tab ↗
              </a>
            </div>
            <iframe
              src="/api/docs"
              title="Swagger API Docs"
              className="w-full h-full border-0"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPage;

