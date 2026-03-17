import React, { useState, useEffect } from 'react';
import apiClient from '../services/apiClient';
import {
    User, Mail, Calendar, Clock, Shield, Key, Trash2,
    CheckCircle2, AlertCircle, Loader2, Edit2, Save, X,
    Zap, FileText, Activity, LogOut
} from 'lucide-react';

interface UserProfile {
    user_id: string;
    username: string;
    email: string;
    full_name: string | null;
    is_active: boolean;
    created_at: string;
    last_login: string | null;
}

interface UserStats {
    workflow_count: number;
    template_count: number;
    member_since: string;
    last_login: string | null;
}

interface ProfilePageProps {
    onLogout: () => void;
}

type Section = 'overview' | 'security' | 'danger';

const ProfilePage: React.FC<ProfilePageProps> = ({ onLogout }) => {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [stats, setStats] = useState<UserStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [section, setSection] = useState<Section>('overview');

    // Edit name
    const [editingName, setEditingName] = useState(false);
    const [nameValue, setNameValue] = useState('');
    const [nameSaving, setNameSaving] = useState(false);
    const [nameMsg, setNameMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

    // Change password
    const [pwCurrent, setPwCurrent] = useState('');
    const [pwNew, setPwNew] = useState('');
    const [pwConfirm, setPwConfirm] = useState('');
    const [pwSaving, setPwSaving] = useState(false);
    const [pwMsg, setPwMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

    // Delete account
    const [deleteConfirm, setDeleteConfirm] = useState('');
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteMsg, setDeleteMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        setLoading(true);
        try {
            const [meRes, statsRes] = await Promise.all([
                apiClient.get('/auth/me'),
                apiClient.get('/auth/me/stats'),
            ]);
            setProfile(meRes.data);
            setStats(statsRes.data);
            setNameValue(meRes.data.full_name || '');
        } catch (e) {
            console.error('Failed to load profile', e);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveName = async () => {
        if (!nameValue.trim()) return;
        setNameSaving(true);
        setNameMsg(null);
        try {
            const res = await apiClient.patch('/auth/me', { full_name: nameValue.trim() });
            setProfile(res.data);
            // Update cached user in localStorage
            const cached = localStorage.getItem('user');
            if (cached) {
                const u = JSON.parse(cached);
                localStorage.setItem('user', JSON.stringify({ ...u, full_name: res.data.full_name }));
            }
            setEditingName(false);
            setNameMsg({ type: 'ok', text: 'Name updated successfully.' });
        } catch (e: any) {
            setNameMsg({ type: 'err', text: e.response?.data?.detail || 'Failed to update name.' });
        } finally {
            setNameSaving(false);
            setTimeout(() => setNameMsg(null), 3000);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (pwNew !== pwConfirm) {
            setPwMsg({ type: 'err', text: 'New passwords do not match.' });
            return;
        }
        if (pwNew.length < 8) {
            setPwMsg({ type: 'err', text: 'Password must be at least 8 characters.' });
            return;
        }
        setPwSaving(true);
        setPwMsg(null);
        try {
            const res = await apiClient.post('/auth/me/change-password', {
                current_password: pwCurrent,
                new_password: pwNew,
                confirm_password: pwConfirm,
            });
            setPwMsg({ type: 'ok', text: res.data.message });
            setPwCurrent(''); setPwNew(''); setPwConfirm('');
        } catch (e: any) {
            setPwMsg({ type: 'err', text: e.response?.data?.detail || 'Failed to change password.' });
        } finally {
            setPwSaving(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (deleteConfirm !== profile?.username) return;
        setDeleteLoading(true);
        try {
            await apiClient.delete('/auth/me');
            localStorage.clear();
            onLogout();
        } catch (e: any) {
            setDeleteMsg({ type: 'err', text: e.response?.data?.detail || 'Failed to delete account.' });
            setDeleteLoading(false);
        }
    };

    // Avatar initials
    const initials = profile
        ? (profile.full_name?.trim()
            ? profile.full_name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
            : profile.username.slice(0, 2).toUpperCase())
        : '??';

    const fmt = (d: string | null) =>
        d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

    const fmtFull = (d: string | null) =>
        d ? new Date(d).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never';

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-aida-teal" />
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="flex items-center justify-center h-full text-slate-400">
                <p>Failed to load profile.</p>
            </div>
        );
    }

    return (
        <div className="h-full overflow-auto bg-slate-50">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

                {/* ── Hero card ── */}
                <div className="bg-gradient-to-br from-aida-dark via-aida-teal to-[#005560] rounded-2xl p-6 mb-6 shadow-xl shadow-aida-teal/20">
                    <div className="flex items-center gap-5">
                        <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-white text-2xl font-bold shadow-inner border border-white/30 shrink-0">
                            {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h1 className="text-2xl font-bold text-white truncate">
                                {profile.full_name || profile.username}
                            </h1>
                            <p className="text-aida-mint text-sm mt-0.5">@{profile.username}</p>
                            <div className="flex items-center gap-1.5 mt-2">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-400/20 border border-emerald-300/30 text-emerald-200 rounded-full text-xs font-medium">
                                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                                    Active
                                </span>
                                <span className="text-aida-mint/80 text-xs">Member since {fmt(profile.created_at)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-3 mt-5">
                        {[
                            { icon: <Zap className="w-4 h-4" />, label: 'Workflows', value: stats?.workflow_count ?? 0 },
                            { icon: <FileText className="w-4 h-4" />, label: 'Templates', value: stats?.template_count ?? 0 },
                            { icon: <Activity className="w-4 h-4" />, label: 'Last Login', value: stats?.last_login ? new Date(stats.last_login).toLocaleDateString() : 'Today' },
                        ].map(s => (
                            <div key={s.label} className="bg-white/10 backdrop-blur rounded-xl p-3 text-center border border-white/10">
                                <div className="flex justify-center text-aida-mint/80 mb-1">{s.icon}</div>
                                <div className="text-xl font-bold text-white">{s.value}</div>
                                <div className="text-xs text-aida-mint/70">{s.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Section tabs ── */}
                <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 mb-6 shadow-sm">
                    {([
                        { id: 'overview', label: 'Overview', icon: <User className="w-4 h-4" /> },
                        { id: 'security', label: 'Security', icon: <Key className="w-4 h-4" /> },
                        { id: 'danger', label: 'Danger Zone', icon: <Trash2 className="w-4 h-4" /> },
                    ] as { id: Section; label: string; icon: React.ReactNode }[]).map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setSection(tab.id)}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${section === tab.id
                                ? tab.id === 'danger'
                                    ? 'bg-red-50 text-red-600 shadow-sm'
                                    : 'bg-aida-light text-aida-dark shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            {tab.icon}
                            <span className="hidden sm:inline">{tab.label}</span>
                            <span className="sm:hidden">{tab.id === 'overview' ? 'Info' : tab.id === 'security' ? 'Security' : 'Danger'}</span>
                        </button>
                    ))}
                </div>

                {/* ── OVERVIEW ── */}
                {section === 'overview' && (
                    <div className="space-y-4">
                        {/* Display name */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                                    <User className="w-4 h-4 text-aida-teal" /> Display Name
                                </h3>
                                {!editingName && (
                                    <button
                                        onClick={() => { setEditingName(true); setNameValue(profile.full_name || ''); }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-aida-teal bg-aida-light hover:bg-aida-mint rounded-lg transition-colors"
                                    >
                                        <Edit2 className="w-3.5 h-3.5" /> Edit
                                    </button>
                                )}
                            </div>
                            {editingName ? (
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={nameValue}
                                        onChange={e => setNameValue(e.target.value)}
                                        maxLength={100}
                                        placeholder="Your full name"
                                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-aida-teal focus:border-transparent"
                                        autoFocus
                                        onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                                    />
                                    <button
                                        onClick={handleSaveName}
                                        disabled={nameSaving || !nameValue.trim()}
                                        className="px-3 py-2 bg-aida-teal text-white rounded-lg text-sm font-medium hover:bg-aida-dark disabled:opacity-50 flex items-center gap-1.5"
                                    >
                                        {nameSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                        Save
                                    </button>
                                    <button
                                        onClick={() => setEditingName(false)}
                                        className="px-3 py-2 border border-slate-200 text-slate-500 rounded-lg text-sm hover:bg-slate-50"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ) : (
                                <p className="text-slate-700 font-medium">{profile.full_name || <span className="text-slate-400 italic">Not set</span>}</p>
                            )}
                            {nameMsg && (
                                <p className={`mt-2 text-xs flex items-center gap-1 ${nameMsg.type === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {nameMsg.type === 'ok' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                                    {nameMsg.text}
                                </p>
                            )}
                        </div>

                        {/* Account info (read-only) */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                            <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-4">
                                <Shield className="w-4 h-4 text-aida-teal" /> Account Information
                            </h3>
                            <div className="space-y-3">
                                {[
                                    { icon: <User className="w-4 h-4 text-slate-400" />, label: 'Username', value: `@${profile.username}` },
                                    { icon: <Mail className="w-4 h-4 text-slate-400" />, label: 'Email', value: profile.email },
                                    { icon: <Calendar className="w-4 h-4 text-slate-400" />, label: 'Member Since', value: fmt(profile.created_at) },
                                    { icon: <Clock className="w-4 h-4 text-slate-400" />, label: 'Last Login', value: fmtFull(profile.last_login) },
                                ].map(row => (
                                    <div key={row.label} className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
                                        <div className="w-8 flex justify-center shrink-0">{row.icon}</div>
                                        <span className="text-xs text-slate-400 w-28 shrink-0">{row.label}</span>
                                        <span className="text-sm text-slate-700 font-medium">{row.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── SECURITY ── */}
                {section === 'security' && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                        <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-1">
                            <Key className="w-4 h-4 text-aida-teal" /> Change Password
                        </h3>
                        <p className="text-xs text-slate-400 mb-5">After changing your password, all other sessions will be signed out.</p>

                        <form onSubmit={handleChangePassword} className="space-y-4">
                            {[
                                { label: 'Current Password', value: pwCurrent, setter: setPwCurrent, placeholder: 'Enter current password' },
                                { label: 'New Password', value: pwNew, setter: setPwNew, placeholder: 'Min. 8 characters' },
                                { label: 'Confirm New Password', value: pwConfirm, setter: setPwConfirm, placeholder: 'Repeat new password' },
                            ].map(field => (
                                <div key={field.label}>
                                    <label className="block text-xs font-medium text-slate-600 mb-1.5">{field.label}</label>
                                    <input
                                        type="password"
                                        value={field.value}
                                        onChange={e => field.setter(e.target.value)}
                                        placeholder={field.placeholder}
                                        required
                                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-aida-teal focus:border-transparent transition-all"
                                    />
                                </div>
                            ))}

                            {pwMsg && (
                                <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm ${pwMsg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                                    {pwMsg.type === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                                    {pwMsg.text}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={pwSaving || !pwCurrent || !pwNew || !pwConfirm}
                                className="w-full py-2.5 bg-aida-teal text-white rounded-xl font-medium text-sm hover:bg-aida-dark disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                            >
                                {pwSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                                Update Password
                            </button>
                        </form>
                    </div>
                )}

                {/* ── DANGER ZONE ── */}
                {section === 'danger' && (
                    <div className="bg-white rounded-2xl border-2 border-red-200 p-5 shadow-sm">
                        <h3 className="font-semibold text-red-700 flex items-center gap-2 mb-1">
                            <Trash2 className="w-4 h-4" /> Delete Account
                        </h3>
                        <p className="text-sm text-slate-500 mb-5">
                            This will permanently delete your account, all workflows, templates, and data. This action cannot be undone.
                        </p>

                        <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-4">
                            <p className="text-xs text-red-600 font-medium mb-2">
                                Type your username <span className="font-bold font-mono bg-red-100 px-1.5 py-0.5 rounded">{profile.username}</span> to confirm:
                            </p>
                            <input
                                type="text"
                                value={deleteConfirm}
                                onChange={e => setDeleteConfirm(e.target.value)}
                                placeholder={profile.username}
                                className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm focus:ring-2 focus:ring-red-400 focus:border-transparent bg-white"
                            />
                        </div>

                        {deleteMsg && (
                            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm bg-red-50 text-red-700 border border-red-100 mb-4">
                                <AlertCircle className="w-4 h-4 shrink-0" />{deleteMsg.text}
                            </div>
                        )}

                        <button
                            onClick={handleDeleteAccount}
                            disabled={deleteConfirm !== profile.username || deleteLoading}
                            className="w-full py-2.5 bg-red-600 text-white rounded-xl font-medium text-sm hover:bg-red-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
                        >
                            {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            Permanently Delete Account
                        </button>
                    </div>
                )}

                {/* ── Sign out shortcut ── */}
                <div className="mt-6 flex justify-end">
                    <button
                        onClick={onLogout}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-slate-200"
                    >
                        <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;
