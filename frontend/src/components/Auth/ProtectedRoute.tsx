import { Navigate, useLocation } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions.ts';

export interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const location = useLocation();
  const { canAccess } = usePermissions();

  if (!canAccess(location.pathname)) {
    const fallback = location.pathname === '/' ? '/dashboards' : '/not-authorized';
    return <Navigate to={fallback} replace />;
  }

  return children;
};

export default ProtectedRoute;
