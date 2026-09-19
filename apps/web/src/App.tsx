import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { RequireAdmin } from '@/features/auth/RequireAdmin';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { RequireManager } from '@/features/auth/RequireManager';
import { LoginPage } from '@/pages/Login';
import { HomePage } from '@/pages/Home';
import { DailyWorkPage } from '@/pages/DailyWork';
import { DailyWorkMonitorPage } from '@/pages/DailyWorkMonitor';
import { DailyWorkSettingsPage } from '@/pages/DailyWorkSettings';
import { ChatPage } from '@/pages/Chat';
import { ChannelsPage } from '@/pages/Channels';
import { AuditLogsPage } from '@/pages/AuditLogs';
import { EmployeesPage } from '@/pages/Employees';
import { MeetingsPage } from '@/pages/Meetings';
import { NotificationsPage } from '@/pages/Notifications';
import { RequireSales } from '@/features/sales/RequireSales';
import { SalesPage } from '@/pages/Sales';
import { SettingsPage } from '@/pages/Settings';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/daily-work" element={<DailyWorkPage />} />
            <Route path="/daily-work/plan" element={<DailyWorkPage />} />
            <Route path="/chat/:conversationId?" element={<ChatPage />} />
            <Route path="/meetings" element={<MeetingsPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route element={<RequireSales />}>
              <Route path="/sales" element={<SalesPage />} />
            </Route>
            <Route element={<RequireManager />}>
              <Route path="/admin/daily-work" element={<DailyWorkMonitorPage />} />
            </Route>
            <Route element={<RequireAdmin />}>
              <Route path="/employees" element={<EmployeesPage />} />
              <Route
                path="/admin/daily-work-settings"
                element={<DailyWorkSettingsPage />}
              />
              <Route path="/admin/channels" element={<ChannelsPage />} />
              <Route path="/admin/audit-logs" element={<AuditLogsPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
