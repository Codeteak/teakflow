import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { RefreshCw } from 'lucide-react';
import type { SessionUser } from '@teakflow/shared';
import { buildIdCardFaces } from '@/components/home/buildIdCardFaces';
import Lanyard from '@/components/lanyard/Lanyard';
import lanyardBandUrl from '@/components/lanyard/lanyard-band.png';
import { buttonClassName } from '@/components/ui/button';
import { cn } from '@/lib/cn';

type Props = {
  user: SessionUser;
  /** overlay = desktop right canvas; section = mobile block under home cards */
  placement?: 'overlay' | 'section';
};

class LanyardErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Lanyard failed to render', error, info);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="flex h-full min-h-[280px] items-center justify-center px-4 text-center text-sm text-muted">
          ID card could not load on this device.
        </div>
      );
    }
    return this.props.children;
  }
}

export function HomeIdCard({ user, placement = 'overlay' }: Props) {
  const [faces, setFaces] = useState<{ frontImage: string; backImage: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const [showBack, setShowBack] = useState(false);
  const isSection = placement === 'section';

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    buildIdCardFaces(user)
      .then((next) => {
        if (!cancelled) setFaces(next);
      })
      .catch((error) => {
        console.error('Failed to build ID card faces', error);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user.id, user.name, user.email, user.avatar, user.designation, user.department, user.companyId, user.role]);

  if (failed) {
    return (
      <div
        className={cn(
          'flex items-center justify-center px-4 text-center text-sm text-muted',
          isSection ? 'min-h-[280px] rounded-xl border border-line bg-surface' : 'h-full min-h-[480px]',
        )}
      >
        ID card could not load on this device.
      </div>
    );
  }

  return (
    <div
      className={cn(
        isSection
          ? 'pointer-events-auto relative h-[min(58vh,26rem)] w-full overflow-hidden rounded-xl border border-line bg-surface'
          : 'pointer-events-none absolute inset-0 z-10 min-h-[calc(100dvh-3rem)]',
      )}
    >
      <div className={cn('pointer-events-auto absolute inset-0', isSection && 'rounded-xl')}>
        <LanyardErrorBoundary>
          <Lanyard
            position={[0, 0, 24]}
            fov={20}
            gravity={[0, -40, 0]}
            frontImage={faces?.frontImage ?? null}
            backImage={faces?.backImage ?? null}
            imageFit="cover"
            lanyardImage={lanyardBandUrl}
            lanyardWidth={1}
            offset={isSection ? [0, 0, 0] : [1.15, 0, 0]}
            showBack={showBack}
            className={isSection ? 'h-full w-full' : undefined}
          />
        </LanyardErrorBoundary>
      </div>

      <div
        className={cn(
          'pointer-events-auto absolute z-30',
          isSection
            ? 'right-3 bottom-3'
            : 'right-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:right-6 md:bottom-6',
        )}
      >
        <motion.button
          type="button"
          aria-pressed={showBack}
          aria-label={showBack ? 'Show front of company tag' : 'Show back of company tag'}
          onClick={() => setShowBack((value) => !value)}
          className={cn(buttonClassName('outline'), 'bg-surface')}
          whileTap={{ scale: 0.97 }}
          transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.span
            key={showBack ? 'back' : 'front'}
            initial={{ rotate: showBack ? -180 : 180, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="inline-flex"
          >
            <RefreshCw size={16} strokeWidth={1.75} />
          </motion.span>
          {showBack ? 'Show front' : 'View back'}
        </motion.button>
      </div>
    </div>
  );
}
