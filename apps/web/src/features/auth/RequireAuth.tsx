import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { meRequest } from '@/features/auth/api';
import { LoginPage } from '@/pages/Login';
import { apiUrl } from '@/services/api/baseUrl';
import { consumeLoggedOutFlag, useAuthStore } from '@/store/auth';

const ACCESS_REFRESH_MS = 2.5 * 60 * 60 * 1000;

export function RequireAuth() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [ready, setReady] = useState(Boolean(user));

  useEffect(() => {
    if (user) {
      setReady(true);
      return;
    }

    if (consumeLoggedOutFlag()) {
      setReady(true);
      return;
    }

    let cancelled = false;

    meRequest()
      .then((session) => {
        if (!cancelled) {
          setUser(session);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [setUser, user]);

  useEffect(() => {
    if (!user) {
      return;
    }
    const keepAlive = () => {
      void meRequest().catch(() => undefined);
      void fetch(apiUrl('/auth/refresh'), { method: 'POST', credentials: 'include' });
    };
    const timer = window.setInterval(keepAlive, ACCESS_REFRESH_MS);
    const accessCheck = window.setInterval(() => {
      void meRequest().catch(() => undefined);
    }, 15_000);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(accessCheck);
    };
  }, [user]);

  if (!ready) {
    return <div className="min-h-dvh bg-paper" />;
  }

  if (!useAuthStore.getState().user) {
    // Stay on `/` (or the deep link) so Vercel hard-refresh does not hit `/login`
    // before SPA rewrites are applied. `/login` remains available as an alias.
    return <LoginPage />;
  }

  return <Outlet />;
}
