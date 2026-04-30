import api from '@/lib/api';
import type { LoginForm, RegisterForm, TokenResponse, UserProfile } from '@/types/auth';

export async function login(payload: LoginForm): Promise<TokenResponse> {
  const response = await api.post('/auth/login', payload);
  return response.data;
}

export async function register(
  payload: RegisterForm,
  tenantId?: string,
): Promise<{ user: UserProfile; verification_token: string }> {
  const response = await api.post('/auth/register', payload, {
    headers: tenantId
      ? {
          'x-tenant-id': tenantId,
        }
      : undefined,
  });
  return response.data;
}

export async function fetchCurrentUser(): Promise<UserProfile> {
  const response = await api.get('/auth/me');
  return response.data;
}

export async function updateCurrentUser(payload: Partial<UserProfile>): Promise<UserProfile> {
  const response = await api.patch('/auth/me', payload);
  return response.data;
}

export async function uploadAvatar(file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/files/upload', formData);
  return response.data;
}
