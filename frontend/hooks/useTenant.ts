import { useState, useEffect } from 'react';

export function useTenant() {
  const [tenantId, setTenantId] = useState<string | null>(null);

  useEffect(() => {
    const storedTenant = typeof window !== 'undefined' ? window.localStorage.getItem('tenant_id') : null;
    setTenantId(storedTenant);
  }, []);

  return { tenantId };
}
