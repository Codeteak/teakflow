import { isTeamSupervisorRole } from '@teakflow/shared';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';

export function RequireManager() {
  const role = useAuthStore((state) => state.user?.role);
  if (!role || !isTeamSupervisorRole(role)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
