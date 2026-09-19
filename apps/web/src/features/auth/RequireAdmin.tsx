import { ROLES } from '@teakflow/shared';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';

export function RequireAdmin() {
  const role = useAuthStore((state) => state.user?.role);
  if (role !== ROLES.ADMIN) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
