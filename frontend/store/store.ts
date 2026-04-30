import { createContext } from 'react';

export const AppStore = createContext({
  tenantId: null as string | null,
  setTenantId: (tenantId: string | null) => {},
});
