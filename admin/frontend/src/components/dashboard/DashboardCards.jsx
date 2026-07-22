import { Card, CardHeading } from '../ui/Card';

const money = value => `UGX ${Number(value || 0).toLocaleString()}`;

export function AlertBanner({ data = {} }) {
  const count = Number(data.activeAlerts || 0);
  if (!count) return null;
  return <div className="alert"><span className="alert-icon">!</span><div><b>{count} operational alert{count === 1 ? '' : 's'} active</b><p>Review security and tracking alerts requiring action.</p></div><button>Investigate</button></div>;
}

export function StatCards({ data = {} }) {
  const values = [
    ['Orders', data.ordersToday || 0, 'Current authorized scope', 'purple'],
    ['Drivers online', data.onlineRiders || 0, 'Fresh operational status', 'green'],
    ['Merchants', data.merchants || 0, 'Active scope records', 'blue'],
    ['COD in field', money(data.codInField), `${data.codExposure?.count || 0} open records`, 'orange'],
    ['Failed orders', data.failedToday || 0, 'Requires operations review', 'red'],
  ];
  return <div className="stats-grid">{values.map(([label, value, detail, tone]) => <Card className="stat-card" key={label}><div className={`stat-icon ${tone}`}>•</div><span className="eyebrow">{label}</span><strong>{value}</strong><p>{detail}</p></Card>)}</div>;
}

const stages = ['Pending', 'Assigned', 'Accepted', 'Picked Up', 'At Hub', 'Out For Delivery'];
export function OverviewCards({ data = {} }) {
  const cod = Number(data.codExposure?.amount || 0);
  const active = stages.reduce((sum, name) => sum + Number(data.statusMix?.[name] || 0), 0);
  return <div className="overview-grid">
    <Card className="cod"><CardHeading title="Current COD exposure" action={<span className="wallet">COD</span>} /><strong className="money">{money(cod)}</strong><p className={data.codExposure?.warning ? 'red-text' : 'positive'}>{data.codExposure?.warning ? 'Field limit warning' : 'Within configured field limit'}</p><div className="cod-split"><div><span>Open records</span><b>{data.codExposure?.count || 0}</b></div><div><span>In field</span><b className="positive">{money(cod)}</b></div><div><span>Limit</span><b className="orange-text">{money(data.codExposure?.limit)}</b></div></div></Card>
    <Card><CardHeading title="Package staging" /><div className="stages">{stages.map(name => { const count = Number(data.statusMix?.[name] || 0); const width = active ? Math.max(3, count / active * 100) : 0; return <div className="stage" key={name}><span>{name}</span><div><i className="violet" style={{ width: `${width}%` }}/></div><b>{count}</b></div>; })}</div><div className="pipeline">Active pipeline <b>{active}</b></div></Card>
    <Card><CardHeading title="Order status mix" /><div className="status-mix"><div><p>Delivered <b>{data.statusMix?.Delivered || 0}</b></p><p>Failed <b>{data.statusMix?.Failed || 0}</b></p><p>Returned <b>{data.statusMix?.Returned || 0}</b></p></div></div></Card>
    <Card><CardHeading title="Network scope" /><div className="target-metrics"><div><span>Merchants</span><b>{data.merchants || 0}</b></div><div><span>Drivers online</span><b className="positive">{data.onlineDrivers || 0}</b></div><div><span>Active alerts</span><b className="red-text">{data.activeAlerts || 0}</b></div></div></Card>
  </div>;
}

export function PerformanceCards({ performance }) {
  if (!performance) return null;
  const duration = value => Number(value) > 0 ? `${Number(value).toLocaleString()} min` : 'No data';
  const values = [
    ['Avg pickup-to-delivery', duration(performance.avgPickupToDeliveryMinutes), 'Target under 45 min'],
    ['Avg placement-to-delivery', duration(performance.avgPlacementToDeliveryMinutes), 'Target under 60 min'],
    ['Avg driver response', duration(performance.avgDriverResponseMinutes), 'Target under 7 min'],
    ['Failed delivery rate', `${Number(performance.failedDeliveryRate || 0)}%`, 'Target under 5%'],
    ['Weekly completion', Number(performance.weeklyCompleted || 0).toLocaleString(), `${Number(performance.weeklyFailed || 0)} failed this week`],
  ];
  return <div className="performance-grid">{values.map(([label, value, note]) => <Card key={label}><span className="eyebrow">{label}</span><strong>{value}</strong><p className="positive">{note}</p></Card>)}</div>;
}
