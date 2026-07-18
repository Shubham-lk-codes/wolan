import { useEffect, useState } from 'react';
import { Brand } from './Sidebar';
import { navigation } from '../../data/dashboard';
import { useRouter } from '../../router/Router';
import { useNotifications } from '../../state/NotificationContext';

export function Topbar({ onMenu }) {
  const { path, navigate } = useRouter();
  const { unreadCount, realtimeConnected } = useNotifications();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 30_000); return () => window.clearInterval(timer); }, []);
  const current = navigation.find(item => item.path === path) || { label: 'HQ Master Dashboard' };
  const isDashboard = path === '/';
  const isMap = path === '/map';
  const showLiveTools = isDashboard || isMap || path === '/hubs';
  const title = path === '/reports' ? 'Reports & Analytics' : path === '/riders' ? 'Hub driver workspace' : isDashboard ? 'HQ Master Dashboard' : current.label;
  const subtitle = path === '/settings' ? 'System configuration, team management, and integrations' : path === '/notifications' ? 'Manage and monitor notification delivery' : path === '/hubs' ? 'Multi-hub HQ overview - all locations' : path === '/reports' ? 'Real backend reporting, COD reconciliation, and operational visibility' : isDashboard ? 'Live overview - All hubs' : path === '/orders' ? 'Create, assign, stage, and track orders in real time' : path === '/riders' ? 'Driver onboarding, compliance, availability, and performance' : isMap ? 'Real-time rider and package GPS tracking - All hubs' : `Manage ${current.label.toLowerCase()} across all hubs`;
  return <header className="topbar">
    <button className="menu-button" onClick={onMenu} aria-label="Open menu">☰</button>
    <div className="top-title"><Brand compact /><span className="divider" /><div><h1>{title}</h1><p>{subtitle}</p></div></div>
    <div className="top-actions">
      {showLiveTools && <label className="search"><span>⌕</span><input aria-label="Search" placeholder="Search orders, riders..." /></label>}
      {showLiveTools && <button className={`live-button ${realtimeConnected?'':'offline'}`} title={realtimeConnected?'Realtime connection active':'Realtime connection unavailable'}><span>⌁</span> {realtimeConnected?'Live':'Offline'}</button>}
      {isMap && <><button className="map-riders">♧ &nbsp; Riders</button><button className="expand-map" aria-label="Expand map">↗</button></>}
      <button className={`bell ${path==='/notifications'?'active':''}`} aria-label={`Notifications, ${unreadCount} unread`} title="Open notifications" onClick={()=>navigate('/notifications')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>{unreadCount>0&&<b>{unreadCount>99?'99+':unreadCount}</b>}</button>
      <div className="clock"><b>{now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</b><span>{now.toLocaleDateString([], {month:'short',day:'2-digit',year:'numeric'})}</span></div>
    </div>
  </header>;
}
