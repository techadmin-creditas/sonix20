import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactElement;
  moduleId?: string;
  adminOnly?: boolean;
}

/**
 * Robust route-level protection.
 * Ensures the user has the required neural clearance before rendering the view.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  moduleId,
  adminOnly = false 
}) => {
  const { currentUser, isAdmin, canRead, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[10px] text-primary font-black uppercase tracking-[0.4em] animate-pulse">
        Authenticating Channel...
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // Check manual admin requirement
  if (adminOnly && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  // Check module-specific read clearance
  if (moduleId && !canRead(moduleId)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};
