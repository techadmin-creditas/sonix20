import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, AuthUser, getAuthToken, clearAuthToken } from '../lib/api';
import { AVAILABLE_MODULES } from '../constants/modules';

interface AuthContextType {
  currentUser: AuthUser | null;
  setCurrentUser: (user: AuthUser | null) => void;
  isLoading: boolean;
  isAdmin: boolean;
  logout: () => void;
  hasPermission: (perm: string) => boolean;
  canRead: (module: string) => boolean;
  canUpdate: (module: string, ownerId?: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = () => {
    clearAuthToken();
    setCurrentUser(null);
  };

  useEffect(() => {
    async function bootstrap() {
      const token = getAuthToken();
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const me = await api.me();
        setCurrentUser(me);
      } catch (err) {
        console.error('Failed to bootstrap auth:', err);
        clearAuthToken();
        setCurrentUser(null);
      } finally {
        setIsLoading(false);
      }
    }
    bootstrap();
  }, []);

  const hasPermission = (perm: string) => {
    if (!currentUser?.permissions) return false;
    if (currentUser.permissions.includes('*')) return true;

    // Generic wildcard support e.g. "read:*" matches "read:dashboard"
    if (perm.includes(':')) {
      const [action] = perm.split(':');
      if (currentUser.permissions.includes(`${action}:*`)) return true;
    }

    return currentUser.permissions.includes(perm);
  };

  const canRead = (moduleId: string) => {
    const module = AVAILABLE_MODULES.find(m => m.id === moduleId);
    const isAdminRole = currentUser?.role === 'admin';

    // Rule: System modules require Admin role OR an EXPLICIT permission override.
    // Notice we check currentUser.permissions directly for the system modules 
    // to bypass the broad "read:*" wildcard check in hasPermission.
    if (module?.isAdminOnly && !isAdminRole) {
      return currentUser?.permissions?.includes(`read:${moduleId}`) || false;
    }

    return hasPermission(`read:${moduleId}`);
  };

  const canUpdate = (module: string, ownerId?: string) => {
    if (hasPermission('*')) return true;
    if (hasPermission(`update:${module}`)) return true;
    
    // update:own logic
    if (hasPermission('update:own') && ownerId && currentUser?.id === ownerId) {
      return true;
    }
    
    return false;
  };

  const value = {
    currentUser,
    setCurrentUser,
    isLoading,
    isAdmin: currentUser?.role === 'admin',
    logout,
    hasPermission,
    canRead,
    canUpdate
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
