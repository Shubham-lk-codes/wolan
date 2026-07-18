import { lazy, Suspense } from 'react';
import { AppShell } from './layouts/AppShell';
import { useRouter } from './router/Router';
import { useAuth } from './state/AuthContext';
import { LoginPage } from './pages/auth/LoginPage';

const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage').then(module => ({ default: module.DashboardPage })));
const OrdersPage = lazy(() => import('./pages/orders/OrdersPage').then(module => ({ default: module.OrdersPage })));
const RidersPage = lazy(() => import('./pages/riders/RidersPage').then(module => ({ default: module.RidersPage })));
const LiveMapPage = lazy(() => import('./pages/map/LiveMapPage').then(module => ({ default: module.LiveMapPage })));
const MerchantsPage = lazy(() => import('./pages/merchants/MerchantsPage').then(module => ({ default: module.MerchantsPage })));
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage').then(module => ({ default: module.ReportsPage })));
const HubManagementPage = lazy(() => import('./pages/hubs/HubManagementPage').then(module => ({ default: module.HubManagementPage })));
const NotificationsPage = lazy(() => import('./pages/notifications/NotificationsPage').then(module => ({ default: module.NotificationsPage })));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage').then(module => ({ default: module.SettingsPage })));
const TrackingPage = lazy(() => import('./pages/tracking/TrackingPage').then(module => ({ default: module.TrackingPage })));
const fallback = <div className="empty-state"><p>Loading module...</p></div>;

export default function App() {
  const { user, loading } = useAuth();
  const { path } = useRouter();
  if (path.startsWith('/track/')) return <Suspense fallback={fallback}><TrackingPage orderId={decodeURIComponent(path.slice('/track/'.length))} /></Suspense>;
  if (loading) return <main className="login-page"><div className="login-card"><p>Loading secure session...</p></div></main>;
  if (!user) return <LoginPage />;
  const routes = {
    '/': <DashboardPage />,
    '/orders': <OrdersPage />,
    '/riders': <RidersPage />,
    '/map': <LiveMapPage />,
    '/merchants': <MerchantsPage />,
    '/reports': <ReportsPage />,
    '/hubs': <HubManagementPage />,
    '/notifications': <NotificationsPage />,
    '/settings': <SettingsPage />,
  };
  return <AppShell><Suspense fallback={fallback}>{routes[path] || <div className="empty-state"><h2>Page not found</h2><p>Use the navigation to return to an operational module.</p></div>}</Suspense></AppShell>;
}
