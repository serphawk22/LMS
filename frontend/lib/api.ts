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
  if (process.env.NODE_ENV === 'development') {
    console.log(`[API Request] ${config.method?.toUpperCase()} ${config.baseURL || ''}${config.url}`);
    if (config.data) {
      console.log(`[API Request Data Payload]`, config.data);
    }
  }

  const headers: Record<string, string> = {
    ...(config.headers as Record<string, string> || {}),
  };

  // Get token and validate it
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  
  if (process.env.NODE_ENV === 'development') {
    console.log('[API] Token from localStorage:', token ? `present (${token.substring(0, 20)}...)` : 'null/missing');
  }

  if (token) {
    if (isAccessTokenValid(token)) {
      headers.Authorization = `Bearer ${token}`;
      if (process.env.NODE_ENV === 'development') {
        console.log('[API] Token validated successfully, Authorization header set');
      }
    } else {
      // Token is expired or invalid - clear it
      clearAccessToken();
      if (process.env.NODE_ENV === 'development') {
        console.warn('[API] Token expired or invalid, cleared from storage');
      }
    }
  } else {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[API] No access_token in localStorage');
    }
  }

  // Always try to get tenant_id from localStorage first, then from token
  let tenant = typeof window !== 'undefined'
    ? localStorage.getItem('tenant_id')
    : process.env.NEXT_PUBLIC_TENANT_ID;

  // If no tenant in localStorage, extract from token and cache it
  if ((!tenant || tenant === 'null' || tenant === 'undefined') && token) {
    const payload = decodeTokenPayload(token);
    tenant = payload?.tenant_id ? String(payload.tenant_id) : null;
    if (tenant && typeof window !== 'undefined') {
      localStorage.setItem('tenant_id', tenant);
      if (process.env.NODE_ENV === 'development') {
        console.log('[API] Extracted tenant_id from token:', tenant);
      }
    }
  }

  if (tenant && tenant !== 'null' && tenant !== 'undefined') {
    headers['x-tenant-id'] = tenant;
    if (process.env.NODE_ENV === 'development') {
      console.log('[API] x-tenant-id header set:', tenant);
    }
  } else {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[API] No tenant_id found for request:', config.url);
    }
  }

  // Log final headers
  if (process.env.NODE_ENV === 'development') {
    console.log('[API] Final request headers:', {
      Authorization: headers.Authorization ? `Bearer ${headers.Authorization.substring(0, 30)}...` : 'MISSING',
      'x-tenant-id': headers['x-tenant-id'] || 'MISSING',
    });
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
  (response) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API Response] ${response.status} ${response.config.url}`, response.data);
    }
    return response;
  },
  async (error) => {
    if (process.env.NODE_ENV === 'development') {
      console.error(`[API Error]`, error.response?.status, error.config?.url, error.response?.data || error.message);
    }
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

        // Extract and save tenant_id from new access token
        try {
          const payload = newAccessToken.split('.')[1];
          const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
          const decoded = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
          const decodedPayload = JSON.parse(decoded);
          if (decodedPayload?.tenant_id) {
            localStorage.setItem('tenant_id', String(decodedPayload.tenant_id));
          }
        } catch {
          // Ignore decode errors
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
