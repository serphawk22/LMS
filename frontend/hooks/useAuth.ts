'use client';

import { useEffect, useState } from 'react';
import { clearAccessToken, isAuthenticated } from '@/lib/auth';
import { getOrganization, type Organization } from '@/services/organizations';

interface AuthState {
  authenticated: boolean;
  initialized: boolean;
  role: string | null;
  tenantId: string | null;
  userId: string | null;
  user: { id: string } | null;
  organization: Organization | null;
}

function decodePayload(token: string): Record<string, unknown> {
  try {
    const base64 = token.split('.')[1];
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return {};
  }
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    authenticated: false,
    initialized: false,
    role: null,
    tenantId: null,
    userId: null,
    user: null,
    organization: null,
  });

  useEffect(() => {
    const auth = isAuthenticated();
    if (!auth) {
      clearAccessToken();
      setState({ authenticated: false, initialized: true, role: null, tenantId: null, userId: null, user: null, organization: null });
      return;
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
      setState({ authenticated: false, initialized: true, role: null, tenantId: null, userId: null, user: null, organization: null });
      return;
    }

    const payload = decodePayload(token);
    const adminRoles = ['organization_admin', 'super_admin', 'admin'];
    const role = (payload.role as string) ?? null;
    const isAdmin = role && adminRoles.includes(role);
    const userId = payload.sub ? String(payload.sub) : null;
    const tenantIdFromToken = payload.tenant_id ? String(payload.tenant_id) : null;

    // Save tenant_id to localStorage if present in token
    if (tenantIdFromToken && typeof window !== 'undefined') {
      window.localStorage.setItem('tenant_id', tenantIdFromToken);
    }

    setState({
      authenticated: true,
      initialized: true,
      role,
      tenantId: tenantIdFromToken,
      userId,
      user: userId ? { id: userId } : null,
      organization: null,
    });

    // Fetch organization info if user is admin
    if (isAdmin) {
      getOrganization()
        .then((org) => {
          setState((prevState) => ({
            ...prevState,
            organization: org,
          }));
        })
        .catch(() => {
          // Silently fail - organization fetch is optional for display purposes
        });
    }
  }, []);

  return state;
}
