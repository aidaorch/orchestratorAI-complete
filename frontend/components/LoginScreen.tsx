import React, { useState } from 'react';
import { Lock, User, Sparkles, AlertCircle, Mail, UserPlus } from 'lucide-react';
import apiClient from '../services/apiClient';

interface LoginScreenProps {
    onLogin: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [fullName, setFullName] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            if (mode === 'register') {
                await apiClient.post('/auth/register', {
                    username,
                    email,
                    password,
                    full_name: fullName
                });
                setSuccess('Registration successful! Please login.');
                setMode('login');
                setPassword('');
            } else {
                const response = await apiClient.post('/auth/login', {
                    username,
                    password
                });
                localStorage.setItem('access_token', response.data.access_token);
                localStorage.setItem('refresh_token', response.data.refresh_token);
                localStorage.setItem('user', JSON.stringify(response.data.user));
                onLogin();
            }
        } catch (err: any) {
            setError(err.response?.data?.detail || 'An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-aida-dark via-[#005560] to-aida-dark flex items-center justify-center p-4">
            {/* Background orbs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-aida-teal/20 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-aida-teal/10 rounded-full blur-3xl" />
            </div>

            <div className="relative z-10 w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <img src="/aida-logo-white.png" alt="Aida" className="h-12 w-auto object-contain mx-auto mb-4" />
                    <p className="text-aida-mint mt-2 text-sm">AI Workflow Orchestration Platform</p>
                </div>

                {/* Card */}
                <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 shadow-2xl">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-semibold text-white">
                            {mode === 'login' ? 'Sign In' : 'Create Account'}
                        </h2>
                        <button
                            onClick={() => {
                                setMode(mode === 'login' ? 'register' : 'login');
                                setError('');
                                setSuccess('');
                            }}
                            className="text-sm text-aida-mint hover:text-white transition-colors"
                        >
                            {mode === 'login' ? 'Register' : 'Login'}
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-aida-mint mb-2">
                                {mode === 'register' ? 'Username' : 'Username or Email'}
                            </label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-aida-mint/60" />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    placeholder={mode === 'register' ? 'Enter username' : 'Enter username or email'}
                                    required
                                    minLength={mode === 'register' ? 3 : undefined}
                                    maxLength={mode === 'register' ? 50 : undefined}
                                    className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-aida-mint/40 focus:outline-none focus:ring-2 focus:ring-aida-teal focus:border-transparent transition-all"
                                />
                            </div>
                            {mode === 'register' && username && username.length < 3 && (
                                <p className="text-xs text-red-300 mt-1">Username must be at least 3 characters</p>
                            )}
                        </div>

                        {mode === 'register' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-aida-mint mb-2">Email</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-aida-mint/60" />
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            placeholder="Enter your email"
                                            required
                                            className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-aida-mint/40 focus:outline-none focus:ring-2 focus:ring-aida-teal focus:border-transparent transition-all"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-aida-mint mb-2">Full Name</label>
                                    <div className="relative">
                                        <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-aida-mint/60" />
                                        <input
                                            type="text"
                                            value={fullName}
                                            onChange={e => setFullName(e.target.value)}
                                            placeholder="Enter your full name"
                                            required
                                            className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-aida-mint/40 focus:outline-none focus:ring-2 focus:ring-aida-teal focus:border-transparent transition-all"
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-aida-mint mb-2">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-aida-mint/60" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    required
                                    minLength={8}
                                    className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-aida-mint/40 focus:outline-none focus:ring-2 focus:ring-aida-teal focus:border-transparent transition-all"
                                />
                            </div>
                            {mode === 'register' && password && password.length < 8 && (
                                <p className="text-xs text-red-300 mt-1">Password must be at least 8 characters</p>
                            )}
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 bg-red-500/20 border border-red-400/30 rounded-xl px-4 py-3 text-red-300 text-sm">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="flex items-center gap-2 bg-aida-teal/20 border border-aida-teal/30 rounded-xl px-4 py-3 text-aida-mint text-sm">
                                <Sparkles className="w-4 h-4 shrink-0" />
                                {success}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-gradient-to-r from-aida-teal to-aida-dark hover:from-aida-teal/90 hover:to-aida-dark/90 text-white font-semibold rounded-xl transition-all shadow-lg shadow-aida-teal/30 hover:shadow-aida-teal/50 hover:scale-[1.02] active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100"
                        >
                            {loading ? (mode === 'login' ? 'Signing in...' : 'Creating account...') : (mode === 'login' ? 'Sign In' : 'Create Account')}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-xs text-aida-mint/50">
                        Aida — AI Workflow Orchestration Platform
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginScreen;
