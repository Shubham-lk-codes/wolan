import { navigation } from '../../data/dashboard';
import { Link, useRouter } from '../../router/Router';

function Brand({ compact = false }) {
  return <div className={`brand ${compact ? 'brand-compact' : ''}`}>
    <div className="brand-mark"><b>W</b><small>WOLAN</small></div>
    {!compact && <div><strong>WOLAN</strong><span>Logistics Admin</span></div>}
  </div>;
}

export function Sidebar({ open, onClose }) {
  const { path } = useRouter();
  return <>
    <button aria-label="Close menu" className={`sidebar-overlay ${open ? 'show' : ''}`} onClick={onClose} />
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <Brand />
      <div className="view-switch"><i /> <b>HQ Master View</b><span>›</span></div>
      <nav>
        {navigation.map(item => <Link className={path === item.path ? 'active' : ''} to={item.path} key={item.label} onClick={onClose}><span className="nav-icon">{item.icon}</span>{item.label}{path === item.path && <i />}</Link>)}
      </nav>
      <div className="sidebar-user">
        <div className="avatar">SA</div><div><b>System Administrator</b><span>super admin</span></div><i />
      </div>
      <button className="logout"><span>↪</span> Logout</button>
    </aside>
  </>;
}

export { Brand };
