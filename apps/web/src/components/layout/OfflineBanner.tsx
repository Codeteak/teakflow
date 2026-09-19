import { useOnlineStatus } from '@/lib/useOnlineStatus';

export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) {
    return null;
  }

  return (
    <p className="border-b border-line bg-amber-soft px-4 py-2 text-center text-xs text-amber md:px-6">
      You are offline. Cached pages and daily-work drafts still work. Sending chat or
      meetings needs a connection.
    </p>
  );
}
