import { useEffect, useState } from 'react';
import { isBrowserOnline } from '@/lib/offlineCache';

export function useOnlineStatus() {
  const [online, setOnline] = useState(isBrowserOnline);

  useEffect(() => {
    function sync() {
      setOnline(isBrowserOnline());
    }
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  return online;
}
