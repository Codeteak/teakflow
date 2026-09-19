import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { loginRequest, meRequest } from '@/features/auth/api';
import { consumeLoggedOutFlag, consumeRestrictedMessage, useAuthStore } from '@/store/auth';

export function LoginPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(() => consumeRestrictedMessage() ?? '');
  const [pending, setPending] = useState(false);
  const [checking, setChecking] = useState(!user);

  useEffect(() => {
    if (user) {
      setChecking(false);
      return;
    }
    if (consumeLoggedOutFlag()) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    meRequest()
      .then((session) => {
        if (!cancelled) setUser(session);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [setUser, user]);

  if (checking) {
    return <div className="min-h-dvh bg-paper" />;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setPending(true);
    try {
      const session = await loginRequest(email, password);
      setUser(session);
      navigate('/', { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign in.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <img
            src="/brand/codeteak-logo.svg"
            alt="Codeteak"
            className="h-10 w-10 object-contain"
          />
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">Sign in to Teakflow</h1>
          <p className="mt-1 text-sm text-muted">Company email and password.</p>
        </div>
        <form className="space-y-3" onSubmit={onSubmit}>
          <Input
            type="email"
            placeholder="Email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {error ? <p className="text-sm text-rose">{error}</p> : null}
          <Button className="w-full" type="submit" disabled={pending}>
            {pending ? 'Signing in…' : 'Continue'}
          </Button>
        </form>
      </div>
    </div>
  );
}
