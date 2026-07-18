import { useMemo, useState } from 'react';
import { useNotifications } from '../../state/NotificationContext';

const titleCase = value => String(value || '').toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
const mapNotification = notification => {
  const status = String(notification.status || 'PENDING').toUpperCase();
  const metadata = notification.metadata || {};
  return {
    ...notification,
    id: notification._id,
    type: status === 'SENT' ? 'Sent' : status === 'FAILED' ? 'Failed' : 'Queued',
    channel: titleCase(notification.channels?.[0] || 'IN_APP'),
    audience: metadata.recipientGroup || notification.recipientType || notification.recipientId || 'System',
    date: new Date(notification.createdAt).toLocaleString(),
  };
};

function Composer({ onClose, onSend }) {
  const [scope, setScope] = useState('Bulk audience');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSending(true);
    setError('');
    try {
      await onSend({ title: data.get('category'), message: data.get('message'), channel: data.get('channel').toLowerCase(), priority: data.get('priority').toLowerCase(), recipientType: scope === 'Bulk audience' ? 'all' : 'user', recipientGroup: data.get('group'), recipientId: data.get('recipientId') || undefined, category: data.get('category') });
      onClose();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Notification could not be sent.');
    } finally { setSending(false); }
  }
  return <div className="notify-modal-backdrop" onMouseDown={event=>event.target===event.currentTarget&&onClose()}><form className="notify-modal" onSubmit={submit}><header><h2>Send Notification</h2><button type="button" onClick={onClose} aria-label="Close">×</button></header><div className="notify-form-grid"><label>Type<select name="channel"><option value="in-app">In-app</option><option>SMS</option><option>WhatsApp</option><option>Email</option><option>Push</option></select></label><label>Priority<select name="priority"><option>Normal</option><option>High</option><option>Critical</option></select></label></div><label>Delivery scope<div className="scope-toggle"><button type="button" className={scope==='Bulk audience'?'active':''} onClick={()=>setScope('Bulk audience')}>Bulk audience</button><button type="button" className={scope==='Single recipient'?'active':''} onClick={()=>setScope('Single recipient')}>Single recipient</button></div></label><label>Category<select name="category"><option>System Alert</option><option>Order Dispatch</option><option>Security Alert</option></select></label><section className="recipient-box"><span>Recipient group</span><div>{['All users','Staff/users','Merchants','Riders','Customers'].map(group=><label key={group}><input type="radio" name="group" value={group} defaultChecked={group==='All users'}/>{group}</label>)}</div>{scope==='Single recipient'&&<label>Recipient ID<input name="recipientId" required pattern="[a-fA-F0-9]{24}" placeholder="24-character user ID"/></label>}<p>In-app notifications are persisted and delivered immediately through authorized realtime rooms. External channels remain queued for provider workers.</p></section><label>Message<textarea name="message" required minLength="2" defaultValue="Test notification from Wolan."/></label>{error&&<div className="warning-note">{error}</div>}<footer><button type="button" onClick={onClose}>Cancel</button><button disabled={sending}>{sending?'Sending...':'Send Notification'}</button></footer></form></div>;
}

export function NotificationsPage() {
  const { items, unreadCount, loading, error, realtimeConnected, send, remove, markRead, markAllRead } = useNotifications();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All Statuses');
  const [channel, setChannel] = useState('All Types');
  const [show, setShow] = useState(false);
  const [actionError, setActionError] = useState('');
  const notifications = useMemo(() => items.map(mapNotification), [items]);
  const visible = useMemo(() => notifications.filter(notification => (status==='All Statuses'||notification.type===status)&&(channel==='All Types'||notification.channel===channel)&&`${notification.title} ${notification.message} ${notification.audience}`.toLowerCase().includes(query.toLowerCase())), [notifications, query, status, channel]);
  const act = async request => { setActionError(''); try { await request(); } catch (requestError) { setActionError(requestError.response?.data?.message || 'Notification action failed.'); } };
  return <div className="notifications-page"><aside className="notification-filters"><h3>Notifications & Filters</h3><label className="notification-search"><span>Q</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search notifications..."/></label><label>Status<select value={status} onChange={event=>setStatus(event.target.value)}><option>All Statuses</option><option>Sent</option><option>Queued</option><option>Failed</option></select></label><label>Type<select value={channel} onChange={event=>setChannel(event.target.value)}><option>All Types</option><option>In App</option><option>Push</option><option>Sms</option><option>Whatsapp</option><option>Email</option></select></label><button className="send-notification" onClick={()=>setShow(true)}>+ &nbsp; Send Notification</button></aside><main className="notification-feed"><header><div><h1>All Notifications</h1><p>{visible.length} shown · {unreadCount} unread <span className={`notification-live ${realtimeConnected?'connected':''}`}>{realtimeConnected?'Live':'Offline'}</span></p></div><button className="mark-all-read" disabled={!unreadCount} onClick={()=>act(markAllRead)}>Mark all read</button></header><div>{(error||actionError)&&<div className="warning-note">{actionError||error}</div>}{loading&&<div className="notification-empty">Loading notifications...</div>}{!loading&&!visible.length&&<div className="notification-empty"><b>No notifications yet</b><span>New operational notifications will appear here instantly.</span></div>}{visible.map(notification=><article className={`notification-card ${notification.readAt?'':'unread'}`} key={notification.id}><i>{notification.readAt?'✓':'NEW'}</i><div className="notification-card-content"><div><b>{notification.title}</b><span>{notification.type}</span></div><small>{notification.channel} · {notification.audience}</small><p>{notification.message}</p><footer><span>{notification.date}</span><span>{titleCase(notification.priority||'NORMAL')} priority</span></footer></div><div className="notification-card-actions">{!notification.readAt&&<button className="read-notification" onClick={()=>act(()=>markRead(notification.id))}>Mark read</button>}<button className="delete-notification" aria-label={`Delete ${notification.title}`} onClick={()=>act(()=>remove(notification.id))}>×</button></div></article>)}</div></main>{show&&<Composer onClose={()=>setShow(false)} onSend={send}/>}</div>;
}
