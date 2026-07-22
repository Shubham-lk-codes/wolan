import { navigation } from '../../data/dashboard';
import { Link, useRouter } from '../../router/Router';
import { useAuth } from '../../state/AuthContext';

function Brand({ compact = false }) {
  return <div className={`brand ${compact ? 'brand-compact' : ''}`}>
    <div className="brand-mark"><b>W</b><small>WOLAN</small></div>
    {!compact && <div><strong>WOLAN</strong><span>Logistics Admin</span></div>}
  </div>;
}

export function Sidebar({ open, onClose }) {
  const { path, navigate } = useRouter();
  const { user, logout } = useAuth();
  const role = String(user?.role || 'ADMIN').toLowerCase().split('_').map(word => word[0]?.toUpperCase() + word.slice(1)).join(' ');
  const initials = String(user?.name || 'Admin').split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
  const isHq = ['SUPER_ADMIN', 'DIRECTOR'].includes(user?.role);
  const handleLogout = () => { onClose(); navigate('/'); logout(); };
  return <>
    <button aria-label="Close menu" className={`sidebar-overlay ${open ? 'show' : ''}`} onClick={onClose} />
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <Brand />
      <div className="view-switch"><i /> <b>{isHq ? 'HQ Master View' : `${user?.hubId || 'Assigned'} Hub View`}</b><span>›</span></div>
      <nav>
        {navigation.map(item => <Link className={path === item.path ? 'active' : ''} to={item.path} key={item.label} onClick={onClose}><span className="nav-icon">{item.icon}</span>{item.label}{path === item.path && <i />}</Link>)}
      </nav>
      <div className="sidebar-user">
        <div className="avatar">{initials}</div><div><b>{user?.name || 'Administrator'}</b><span>{role}</span></div><i />
      </div>
      <button type="button" className="logout" onClick={handleLogout}><span>↪</span> Logout</button>
    </aside>
  </>;
}

export { Brand };
