import { useState } from 'react';
import { Sidebar } from '../components/layout/Sidebar';
import { Topbar } from '../components/layout/Topbar';
import { NotificationProvider } from '../state/NotificationContext';

export function AppShell({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <NotificationProvider>
      <div className="app-shell">
        <Sidebar open={open} onClose={() => setOpen(false)} />
        <div className="app-main">
          <Topbar onMenu={() => setOpen(true)} />
          <main className="page-content">{children}</main>
        </div>
      </div>
    </NotificationProvider>
  );
}
