import axios from 'axios';
import type { AxiosRequestConfig } from 'axios';
import { clearAccessToken, isAccessTokenValid } from '@/lib/auth';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1',
});

function decodeTokenPayload(token: string): Record<string, unknown> {
  try {
    const [, payload] = token.split('.');
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    const decoded = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch {
    return {};
  }
}

api.interceptors.request.use((config) => {
  const headers = {
    ...(config.headers || {}),
  };

  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  if (token) {
    if (isAccessTokenValid(token)) {
      headers.Authorization = `Bearer ${token}`;
    } else {
      clearAccessToken();
    }
  }

  let tenant = typeof window !== 'undefined'
    ? localStorage.getItem('tenant_id')
    : process.env.NEXT_PUBLIC_TENANT_ID;

  if (!tenant && token) {
    const payload = decodeTokenPayload(token);
    tenant = payload?.tenant_id ? String(payload.tenant_id) : null;
    if (tenant && typeof window !== 'undefined') {
      localStorage.setItem('tenant_id', tenant);
    }
  }

  if (tenant) {
    headers['x-tenant-id'] = tenant;
  }

  config.headers = headers as any;
  return config;
});

let isRefreshing = false;
let failedQueue: { resolve: (token: string) => void; reject: (err: unknown) => void }[] = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((p) => {
    if (token) p.resolve(token);
    else p.reject(error);
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null;

      if (!refreshToken) {
        // No refresh token available - user is not authenticated
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('tenant_id');
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${token}`;
              }
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1'}/auth/refresh`,
          { refresh_token: refreshToken },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        const newAccessToken = data.access_token;
        const newRefreshToken = data.refresh_token;

        localStorage.setItem('access_token', newAccessToken);
        if (newRefreshToken) {
          localStorage.setItem('refresh_token', newRefreshToken);
        }

        processQueue(null, newAccessToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('tenant_id');
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default api;
