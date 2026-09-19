import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ROLES } from '@teakflow/shared';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorBanner } from '@/components/ui/page-state';
import { Input } from '@/components/ui/input';
import { PresencePicker } from '@/components/layout/PresencePicker';
import { logoutRequest } from '@/features/auth/api';
import { uploadAvatarRequest } from '@/features/files/api';
import { disconnectGoogleRequest } from '@/features/meetings/api';
import { getSettingsRequest } from '@/features/settings/api';
import { useAuthStore } from '@/store/auth';
import { avatarStatusFromPresence, usePresenceStore } from '@/store/presence';

export function SettingsPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const clearSession = useAuthStore((state) => state.clearSession);
  const selfPresence = usePresenceStore((state) => state.selfStatus);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState('');
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  const googleParam = params.get('google');
  const isAdmin = user?.role === ROLES.ADMIN;

  useEffect(() => {
    if (!isAdmin) {
      return;
    }
    void getSettingsRequest()
      .then((settings) => {
        setGoogleConnected(settings.googleConnected);
        setGoogleEmail(settings.googleConnectedEmail);
      })
      .catch(() => undefined);
  }, [isAdmin, googleParam]);

  async function disconnect() {
    setError('');
    try {
      await disconnectGoogleRequest();
      setGoogleConnected(false);
      setGoogleEmail(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to disconnect Google.');
    }
  }

  async function signOut() {
    if (signingOut) {
      return;
    }
    setSigningOut(true);
    setError('');
    try {
      await logoutRequest();
    } catch {
      // Still clear the local session even if the network call fails.
    }
    clearSession();
    navigate('/login', { replace: true });
  }

  async function onAvatar(files: FileList | null) {
    const file = files?.[0];
    if (!file) {
      return;
    }
    setError('');
    setBusy(true);
    try {
      const next = await uploadAvatarRequest(file);
      setUser(next);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not upload the photo.');
    } finally {
      setBusy(false);
      if (fileRef.current) {
        fileRef.current.value = '';
      }
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted">Keep this screen short. Profile, password, theme.</p>
      </header>
      <Card className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar
            name={user?.name ?? 'You'}
            src={user?.avatar}
            size={64}
            status={avatarStatusFromPresence(selfPresence)}
          />
          <div className="space-y-2">
            <p className="text-sm font-medium">Profile photo</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={(event) => void onAvatar(event.target.files)}
            />
            <Button type="button" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
              {busy ? 'Uploading…' : 'Upload photo'}
            </Button>
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Chat presence</p>
          <PresencePicker />
          <p className="text-xs text-muted">Do not disturb skips realtime notification sounds until you check Notifications.</p>
        </div>
        {error ? <ErrorBanner message={error} /> : null}
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Display name</span>
          <Input defaultValue={user?.name ?? ''} readOnly />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Email</span>
          <Input defaultValue={user?.email ?? ''} readOnly />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Codeteak ID</span>
          <Input defaultValue={user?.companyId ?? 'Not assigned'} readOnly className="font-mono" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Theme</span>
          <Input defaultValue="Quiet Desk · Light" readOnly />
        </label>
        <Button variant="outline" type="button" disabled={signingOut} onClick={() => void signOut()}>
          {signingOut ? 'Signing out…' : 'Sign out'}
        </Button>
      </Card>
      {isAdmin ? (
        <Card className="space-y-3">
          <p className="text-sm font-medium">Company Google Meet</p>
          <p className="text-sm text-muted">
            Connect one Workspace calendar. Meetings are created on that account.
          </p>
          {googleConnected ? (
            <>
              <p className="font-mono text-xs text-muted">{googleEmail ?? 'Connected'}</p>
              <Button type="button" variant="outline" onClick={() => void disconnect()}>
                Disconnect Google
              </Button>
            </>
          ) : (
            <Button type="button" onClick={() => {
              window.location.href = '/api/v1/auth/google';
            }}>
              Connect Google
            </Button>
          )}
        </Card>
      ) : null}
    </div>
  );
}
