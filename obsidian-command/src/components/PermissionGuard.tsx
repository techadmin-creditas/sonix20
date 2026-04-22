import React from 'react';
import { useAuth } from '../contexts/AuthContext';

interface PermissionGuardProps {
  require: {
    module: string;
    action: 'read' | 'update';
    ownerId?: string;
  };
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Higher-order component to conditionally render parts of the UI based on user permissions.
 */
export const PermissionGuard: React.FC<PermissionGuardProps> = ({ require, fallback = null, children }) => {
  const { canRead, canUpdate } = useAuth();
  
  let hasAccess = false;
  if (require.action === 'read') {
    hasAccess = canRead(require.module);
  } else {
    hasAccess = canUpdate(require.module, require.ownerId);
  }

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
