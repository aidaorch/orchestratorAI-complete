import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';

// In production, Nginx proxies /api → backend on the same domain (no CORS).
// In local dev, set VITE_API_URL=http://localhost:8000/api in frontend/.env
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// AI generation can take 30-60s — use a generous timeout
const DEFAULT_TIMEOUT = 90000;

const apiClient: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: DEFAULT_TIMEOUT,
});

// ── Request: attach access token ──────────────────────────────────────────────
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');
        if (token) config.headers.Authorization = `Bearer ${token}`;
        return config;
    },
    (error) => Promise.reject(error)
);

// ── Response: silent token refresh, then force-logout on failure ──────────────
apiClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const original = error.config as AxiosRequestConfig & { _retry?: boolean };

        if (error.response?.status === 401 && !original._retry) {
            original._retry = true;

            const refreshToken = localStorage.getItem('refresh_token');

            if (refreshToken) {
                try {
                    // Use a plain axios call (not apiClient) to avoid interceptor loop
                    const { data } = await axios.post(
                        `${API_BASE_URL}/auth/refresh`,
                        { refresh_token: refreshToken },
                        { timeout: 10000 }
                    );
                    localStorage.setItem('access_token', data.access_token);
                    if (original.headers) {
                        original.headers['Authorization'] = `Bearer ${data.access_token}`;
                    }
                    return apiClient(original);
                } catch {
                    // Refresh failed — fall through to force-logout
                }
            }

            // Clear session and dispatch a custom event so React can react
            // without a hard page reload that causes white-screen flashes
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            localStorage.removeItem('user');
            window.dispatchEvent(new CustomEvent('auth:logout'));
        }

        return Promise.reject(error);
    }
);

export default apiClient;
