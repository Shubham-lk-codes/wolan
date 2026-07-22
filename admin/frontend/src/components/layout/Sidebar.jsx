import { navigation } from '../../data/dashboard';
import { Link, useRouter } from '../../router/Router';
import { useAuth } from '../../state/AuthContext';
import { dashboardPathFor, isHqUser, isHubManager } from '../../config/roles';

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
  const isHq = isHqUser(user);
  const hubManager = isHubManager(user);
  const handleLogout = () => { onClose(); navigate('/'); logout(); };
  return <>
    <button aria-label="Close menu" className={`sidebar-overlay ${open ? 'show' : ''}`} onClick={onClose} />
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <Brand />
      <div className="view-switch"><i /> <b>{isHq ? 'HQ Master View' : hubManager ? 'Assigned Hub' : `${user?.hubId || 'Assigned'} Hub View`}</b><span>›</span></div>
      <nav>
        {navigation.map(item => {const target=item.path==='/'?dashboardPathFor(user):item.path;const active=path===target;return <Link className={active?'active':''} to={target} key={item.label} onClick={onClose}><span className="nav-icon">{item.icon}</span>{item.label}{active&&<i />}</Link>})}
      </nav>
      <div className="sidebar-user" role={hubManager?'button':undefined} tabIndex={hubManager?0:undefined} title={hubManager?'Open profile':undefined} onClick={()=>{if(hubManager){onClose();navigate('/profile')}}} onKeyDown={event=>{if(hubManager&&(event.key==='Enter'||event.key===' ')){event.preventDefault();onClose();navigate('/profile')}}}>
        <div className="avatar">{initials}</div><div><b>{user?.name || 'Administrator'}</b><span>{role}</span></div><i />
      </div>
      <button type="button" className="logout" onClick={handleLogout}><span>↪</span> Logout</button>
    </aside>
  </>;
}

export { Brand };
