import type { UserProfile } from '@/types/auth';

interface JwtPayload {
  tenant_id?: string | number;
  exp?: number | string;
  [key: string]: unknown;
}

function padBase64(value: string) {
  return value + '='.repeat((4 - (value.length % 4)) % 4);
}

function decodeJwt(token: string): JwtPayload {
  try {
    const payload = token.split('.')[1];
    const padded = padBase64(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const decoded = atob(padded);
    const json = decodeURIComponent(
      decoded
        .split('')
        .map((char) => `%${('00' + char.charCodeAt(0).toString(16)).slice(-2)}`)
        .join(''),
    );
    return JSON.parse(json) as JwtPayload;
  } catch {
    return {};
  }
}

export function getTokenPayload(token: string) {
  return decodeJwt(token);
}

export function isAccessTokenValid(token: string) {
  const payload = decodeJwt(token);
  if (!payload || !Object.prototype.hasOwnProperty.call(payload, 'exp')) {
    return false;
  }

  const rawExp = payload.exp;
  const exp = typeof rawExp === 'string' ? Number(rawExp) : rawExp;
  if (typeof exp !== 'number' || Number.isNaN(exp) || exp <= 0) {
    return false;
  }

  return Date.now() / 1000 < exp;
}

export function isAuthenticated() {
  if (typeof window === 'undefined') return false;

  const token = window.localStorage.getItem('access_token');
  return Boolean(token && isAccessTokenValid(token));
}

export function saveAuthToken(token: string) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('access_token', token);
    const payload = decodeJwt(token);
    if (payload?.tenant_id) {
      window.localStorage.setItem('tenant_id', String(payload.tenant_id));
    }
  }
}

export function clearAccessToken() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem('access_token');
  }
}

export function clearAuthToken() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem('access_token');
    window.localStorage.removeItem('refresh_token');
    window.localStorage.removeItem('tenant_id');
    window.localStorage.removeItem('user_profile');
  }
}

export function saveUserProfile(user: UserProfile | Record<string, unknown>) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('user_profile', JSON.stringify(user));
  }
}

export function getUserProfile() {
  if (typeof window !== 'undefined') {
    try {
      const cached = window.localStorage.getItem('user_profile');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function clearUserProfile() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem('user_profile');
  }
}
