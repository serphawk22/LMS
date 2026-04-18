import api from '@/lib/api';
import type { UserProfile } from '@/types/auth';

export interface Organization {
  id: number;
  name: string;
  domain: string | null;
  description: string | null;
  slug: string;
  is_active: boolean;
}

export interface OrganizationUserCreatePayload {
  full_name: string;
  email: string;
  password: string;
  role: 'student' | 'instructor' | 'admin';
}

export interface OrganizationUserUpdatePayload {
  full_name?: string;
  email?: string;
  password?: string;
  role?: 'student' | 'instructor' | 'admin';
  is_active?: boolean;
}

function normalizeUserProfile(user: Record<string, unknown>): UserProfile {
  const role = String(user.role ?? user.role_name ?? '');
  return {
    id: Number(user.id),
    email: String(user.email ?? ''),
    full_name: String(user.full_name ?? ''),
    role,
    role_name: String(user.role_name ?? user.role ?? ''),
    organization_id: user.organization_id ? Number(user.organization_id) : undefined,
  };
}

export async function getOrganization(): Promise<Organization> {
  const response = await api.get('/organizations/me');
  return response.data;
}

export async function listOrganizationUsers(): Promise<UserProfile[]> {
  const response = await api.get('/organizations/users');
  return Array.isArray(response.data)
    ? response.data.map((user: Record<string, unknown>) => normalizeUserProfile(user))
    : [];
}

export async function createOrganizationUser(payload: OrganizationUserCreatePayload): Promise<UserProfile> {
  const response = await api.post('/organizations/users', payload);
  return normalizeUserProfile(response.data);
}

export async function updateOrganizationUser(userId: number, payload: OrganizationUserUpdatePayload): Promise<UserProfile> {
  const response = await api.patch(`/organizations/users/${userId}`, payload);
  return normalizeUserProfile(response.data);
}

export async function deleteOrganizationUser(userId: number): Promise<void> {
  await api.delete(`/organizations/users/${userId}`);
}
