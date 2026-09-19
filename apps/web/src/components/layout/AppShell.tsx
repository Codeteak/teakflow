import type { LucideIcon } from 'lucide-react';
import {
  Calendar,
  ClipboardList,
  Clock,
  Ellipsis,
  Hash,
  Home,
  MessageSquare,
  NotebookPen,
  ScrollText,
  Settings,
  Store,
  Users,
} from 'lucide-react';
import {
  ACCOUNT_RESTRICTED_MESSAGE,
  isTeamSupervisorRole,
  ROLES,
} from '@teakflow/shared';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Avatar } from '@/components/ui/avatar';
import { CountBadge } from '@/components/ui/count-badge';
import { GlobalSearchBar } from '@/components/layout/GlobalSearchBar';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { PresencePicker } from '@/components/layout/PresencePicker';
import { OfflineBanner } from '@/components/layout/OfflineBanner';
import { ToastHost } from '@/components/ui/toast-host';
import {
  listConversationsRequest,
  listNotificationsRequest,
  markNotificationReadRequest,
} from '@/features/chat/api';
import { shouldSuppressChatAlert } from '@/features/chat/activeConversation';
import {
  connectChatSocket,
  disconnectChatSocket,
  subscribeChatSocket,
} from '@/services/socket/chat';
import { canOpenSales } from '@/features/sales/RequireSales';
import { markRestricted, useAuthStore } from '@/store/auth';
import { selectTotalUnread, useChatUnreadStore } from '@/store/chatUnread';
import { useNotificationUnreadStore } from '@/store/notificationUnread';
import { avatarStatusFromPresence, usePresenceStore } from '@/store/presence';
import { primeNotifySound } from '@/lib/notifySound';

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
};

const nav: NavItem[] = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/daily-work', label: 'Daily Work', icon: NotebookPen },
  { to: '/chat', label: 'Chat', icon: MessageSquare },
  { to: '/meetings', label: 'Meetings', icon: Calendar },
];

const mobilePrimary: NavItem[] = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/daily-work', label: 'Daily Work', icon: NotebookPen },
  { to: '/chat', label: 'Chat', icon: MessageSquare },
];

const salesNav: NavItem[] = [{ to: '/sales', label: 'Sales', icon: Store }];
const meetingsNav: NavItem[] = [{ to: '/meetings', label: 'Meetings', icon: Calendar }];

const adminNav: NavItem[] = [
  { to: '/employees', label: 'Employees', icon: Users },
  { to: '/admin/daily-work', label: 'Team daily work', icon: ClipboardList },
  { to: '/admin/daily-work-settings', label: 'Daily Work Settings', icon: Clock },
  { to: '/admin/channels', label: 'Channels', icon: Hash },
  { to: '/admin/audit-logs', label: 'Audit logs', icon: ScrollText },
];

const managerNav: NavItem[] = [
  { to: '/admin/daily-work', label: 'Team daily work', icon: ClipboardList },
];

export function AppShell() {
  const location = useLocation();
  const isChat = location.pathname.startsWith('/chat');
  const isDailyWork = location.pathname.startsWith('/daily-work');
  const isHome = location.pathname === '/';
  const isEmployees = location.pathname.startsWith('/employees');
  const isSales = location.pathname.startsWith('/sales');
  const chatThread = /^\/chat\/[^/]+/.test(location.pathname);
  const [moreOpen, setMoreOpen] = useState(false);
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const selfPresence = usePresenceStore((state) => state.selfStatus);
  const chatUnread = useChatUnreadStore(selectTotalUnread);
  const setOpenId = useChatUnreadStore((state) => state.setOpenId);
  const hydrate = useChatUnreadStore((state) => state.hydrate);
  const noteIncoming = useChatUnreadStore((state) => state.noteIncoming);
  const hydrateNotifications = useNotificationUnreadStore((state) => state.hydrate);
  const noteNewNotification = useNotificationUnreadStore((state) => state.noteNew);

  useEffect(() => {
    const match = location.pathname.match(/^\/chat\/([^/]+)/);
    setOpenId(match?.[1] ?? null);
    setMoreOpen(false);
  }, [location.pathname, setOpenId]);

  useEffect(() => {
    if (!user) {
      disconnectChatSocket();
      return;
    }
    primeNotifySound();
    connectChatSocket();
    void listConversationsRequest()
      .then((data) => hydrate(data.items))
      .catch(() => undefined);
    void listNotificationsRequest()
      .then((rows) => hydrateNotifications(rows.filter((row) => !row.isRead).length))
      .catch(() => undefined);
    const unsubscribe = subscribeChatSocket({
      onMessage(message) {
        noteIncoming(message.conversationId, message.senderId, user.id);
      },
      onNotification(notification) {
        if (shouldSuppressChatAlert(notification)) {
          void markNotificationReadRequest(notification.id).catch(() => undefined);
          return;
        }
        noteNewNotification();
      },
      onSessionEnded() {
        markRestricted(ACCOUNT_RESTRICTED_MESSAGE);
        clearSession();
      },
    });
    return () => {
      unsubscribe();
    };
  }, [
    clearSession,
    hydrate,
    hydrateNotifications,
    noteIncoming,
    noteNewNotification,
    user,
  ]);

  const mobileNav = [...mobilePrimary, ...(canOpenSales(user) ? salesNav : [])];
  const extraMobile = [
    ...meetingsNav,
    ...(user?.role === ROLES.ADMIN ? adminNav : []),
    ...(user?.role && isTeamSupervisorRole(user.role) && user.role !== ROLES.ADMIN
      ? managerNav
      : []),
  ];
  const moreActive = extraMobile.some((item) => isItemActive(location.pathname, item));
  const fullBleed = isChat || isDailyWork || isEmployees || isSales;

  return (
    <div className="flex h-dvh max-h-dvh overflow-hidden bg-paper">
      <aside className="hidden h-full w-[232px] shrink-0 flex-col overflow-y-auto border-r border-line px-4 py-5 scrollbar-none md:flex">
        <div className="mb-8 flex items-center gap-2.5 px-2">
          <img src="/brand/codeteak-logo.svg" alt="" className="h-8 w-8 object-contain" />
          <div>
            <p className="text-sm font-semibold tracking-tight">Teakflow</p>
            <p className="text-[11px] text-muted">Codeteak workspace</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-6">
          <NavGroup items={nav} pathname={location.pathname} chatUnread={chatUnread} />
          {canOpenSales(user) ? (
            <>
              <div className="mx-2 h-px bg-line" />
              <NavGroup items={salesNav} pathname={location.pathname} />
            </>
          ) : null}
          {user?.role === ROLES.ADMIN ? (
            <>
              <div className="mx-2 h-px bg-line" />
              <div>
                <p className="mb-1 px-2.5 text-[11px] font-medium tracking-wide text-muted uppercase">
                  Admin
                </p>
                <NavGroup items={adminNav} pathname={location.pathname} />
              </div>
            </>
          ) : null}
          {user?.role && isTeamSupervisorRole(user.role) && user.role !== ROLES.ADMIN ? (
            <>
              <div className="mx-2 h-px bg-line" />
              <NavGroup items={managerNav} pathname={location.pathname} />
            </>
          ) : null}
        </nav>

        <div className="mt-auto space-y-2 rounded-md border border-line bg-surface px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            <Avatar
              name={user?.name ?? 'Employee'}
              src={user?.avatar}
              size={36}
              status={avatarStatusFromPresence(selfPresence)}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user?.name ?? 'Employee'}</p>
              <PresencePicker />
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <OfflineBanner />
        <div className="relative flex h-12 shrink-0 items-center gap-2 border-b border-line px-3 sm:gap-3 sm:px-5 md:px-8">
          <div className="min-w-0 flex-1 md:pointer-events-none md:absolute md:inset-y-0 md:left-8 md:right-8 md:flex md:flex-1 md:items-center md:justify-center">
            <div className="w-full md:pointer-events-auto md:max-w-md">
              <GlobalSearchBar />
            </div>
          </div>
          <div className="relative z-10 flex h-9 shrink-0 items-center gap-1 md:ml-auto md:bg-paper md:pl-2">
            <NotificationBell />
            <HeaderIconLink
              to="/settings"
              label="Settings"
              active={location.pathname.startsWith('/settings')}
            >
              <Settings size={18} strokeWidth={1.75} />
            </HeaderIconLink>
          </div>
        </div>
        <main
          className={cn(
            'flex min-h-0 flex-1 flex-col scrollbar-none',
            fullBleed ? 'overflow-hidden' : 'overflow-y-auto overscroll-contain',
            isChat
              ? 'p-0'
              : isDailyWork || isEmployees || isSales
                ? 'px-4 py-4 sm:px-6 md:px-8 md:py-5'
                : isHome
                  ? 'px-4 pt-0 pb-5 sm:px-6 md:px-10 md:pb-8'
                  : 'px-4 py-5 sm:px-6 md:px-10 md:py-8',
            !chatThread && 'pb-[calc(4.75rem+env(safe-area-inset-bottom))] md:pb-8',
          )}
        >
          <div
            className={cn(
              'min-h-0',
              fullBleed
                ? 'flex h-full w-full flex-1 flex-col'
                : isHome
                  ? 'mx-auto w-full max-w-none'
                  : 'mx-auto w-full max-w-4xl',
            )}
          >
            <Outlet />
          </div>
        </main>

        {!chatThread ? (
          <nav
            className={cn(
              'fixed inset-x-0 bottom-0 z-30 grid border-t border-line bg-paper px-1 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden',
              canOpenSales(user) ? 'grid-cols-5' : 'grid-cols-4',
            )}
          >
            {mobileNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  'relative flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-md text-[10px]',
                  isItemActive(location.pathname, item) ? 'text-sage' : 'text-muted',
                )}
              >
                <span className="relative inline-flex">
                  <item.icon size={18} strokeWidth={1.75} />
                  {item.to === '/chat' ? (
                    <CountBadge
                      count={chatUnread}
                      className="absolute -top-1.5 -right-2.5"
                    />
                  ) : null}
                </span>
                {item.label.split(' ')[0]}
              </NavLink>
            ))}
            {extraMobile.length > 0 ? (
              <button
                type="button"
                className={cn(
                  'relative flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-md text-[10px]',
                  moreOpen || moreActive ? 'text-sage' : 'text-muted',
                )}
                onClick={() => setMoreOpen((open) => !open)}
              >
                <Ellipsis size={18} strokeWidth={1.75} />
                More
              </button>
            ) : null}
          </nav>
        ) : null}

        {moreOpen && extraMobile.length > 0 ? (
          <div className="fixed inset-0 z-40 md:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-ink/20"
              aria-label="Close menu"
              onClick={() => setMoreOpen(false)}
            />
            <div className="absolute inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] mx-3 overflow-hidden rounded-lg border border-line bg-surface">
              {extraMobile.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={cn(
                    'flex min-h-12 items-center gap-3 border-b border-line px-4 text-sm last:border-b-0',
                    isItemActive(location.pathname, item) ? 'text-sage' : 'text-ink',
                  )}
                >
                  <item.icon size={16} strokeWidth={1.75} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ) : null}
        <ToastHost />
      </div>
    </div>
  );
}

function HeaderIconLink({
  to,
  label,
  active,
  children,
}: {
  to: string;
  label: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <NavLink
      to={to}
      aria-label={label}
      className={cn(
        'relative inline-flex h-9 w-9 items-center justify-center rounded-md',
        active ? 'bg-sage-soft text-sage' : 'text-muted hover:bg-line/60 hover:text-ink',
      )}
    >
      {children}
    </NavLink>
  );
}

function isItemActive(pathname: string, item: NavItem) {
  if (item.end || item.to === '/') {
    return pathname === item.to;
  }
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

function NavGroup({
  items,
  pathname,
  chatUnread,
}: {
  items: NavItem[];
  pathname: string;
  chatUnread?: number;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={cn(
            'flex min-h-10 items-center gap-2.5 rounded-md px-2.5 py-2 text-sm',
            isItemActive(pathname, item)
              ? 'bg-sage-soft text-sage'
              : 'text-muted hover:bg-line/50 hover:text-ink',
          )}
        >
          <span className="relative inline-flex">
            <item.icon size={16} strokeWidth={1.75} />
            {item.to === '/chat' ? (
              <CountBadge
                count={chatUnread ?? 0}
                className="absolute -top-1.5 -right-2.5"
              />
            ) : null}
          </span>
          {item.label}
        </NavLink>
      ))}
    </div>
  );
}
