import { isTeamSupervisorRole, type SessionUser } from '@teakflow/shared';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';

export function canOpenSales(user: SessionUser | null) {
  if (!user) {
    return false;
  }
  if (isTeamSupervisorRole(user.role)) {
    return true;
  }
  if (user.department === 'Sales') {
    return true;
  }
  return (user.headedDepartments ?? []).includes('Sales');
}

export function canManageShops(user: SessionUser | null) {
  return Boolean(user && canOpenSales(user) && isTeamSupervisorRole(user.role));
}

export function canSeeFullCollection(user: SessionUser | null) {
  return Boolean(user && isTeamSupervisorRole(user.role));
}

export function RequireSales() {
  const user = useAuthStore((state) => state.user);
  if (!canOpenSales(user)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
