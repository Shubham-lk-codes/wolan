import { useCallback, useMemo, useState } from 'react';
import { useApiQuery } from '../../hooks/useApiQuery';
import { reportService } from '../../services/resource.service';

const tabs = ['Overview', 'Driver Performance', 'COD Reconciliation', 'Zone Heatmap', 'Customer Reports'];
const periods = [
  ['MONTHLY', 'Monthly'],
  ['QUARTERLY', 'Quarterly'],
  ['YEARLY', 'Yearly'],
  ['ALL', 'All time'],
];
const coreStatuses = ['Pending', 'Picked Up', 'At Hub', 'Out For Delivery', 'Delivered', 'Failed', 'Returned'];
const optionalStatuses = ['Assigned', 'Accepted', 'Cancelled'];

const money = value => `UGX ${Number(value || 0).toLocaleString()}`;
const number = value => Number(value || 0).toLocaleString();
const dateTime = value => value ? new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Not recorded';
const title = value => String(value || '').toLowerCase().split('_').map(word => word[0]?.toUpperCase() + word.slice(1)).join(' ');

const iconPaths = {
  orders: <><path d="M6 4h12l2 4-8 4-8-4 2-4Z"/><path d="M4 8v9l8 4 8-4V8M12 12v9"/></>,
  revenue: <><path d="m4 16 5-5 4 3 7-8"/><path d="M15 6h5v5"/></>,
  time: <><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></>,
  rating: <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>,
  failed: <><path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v4M12 17h.01"/></>,
  riders: <><circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4.4 3.5-7 8-7s7.2 2.6 8 7"/></>,
  cod: <><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5c-.8-.6-1.8-1-3-1-1.7 0-3 .9-3 2s1.2 1.8 3 2.2 3 1 3 2.3-1.3 2.5-3.2 2.5c-1.2 0-2.4-.4-3.3-1.2M12 5.5v13"/></>,
  zones: <><path d="M12 21s7-5.3 7-12a7 7 0 0 0-14 0c0 6.7 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/></>,
  customers: <><circle cx="9" cy="8" r="3"/><circle cx="17" cy="10" r="2"/><path d="M3 20c.5-4 2.5-6 6-6s5.5 2 6 6M14 15c3.5-.8 6 .8 7 4"/></>,
};

function Icon({ name }) {
  return <svg className="report-icon" viewBox="0 0 24 24" aria-hidden="true">{iconPaths[name] || iconPaths.orders}</svg>;
}

function Scope({ data }) {
  return <div className="report-scope"><span><b>Scope:</b> {data.scopeLabel || 'Authorized hubs'}</span><i/><span><b>Period:</b> {data.range?.label || 'Loading period'}</span></div>;
}

function Metric({ label, value, note, tone = '', icon = 'orders' }) {
  return <article className={`report-metric${tone ? ` report-metric-${tone}` : ''}`}>
    <header><Icon name={icon}/><span>{label}</span></header>
    <strong>{value}</strong>
    <small>{note}</small>
  </article>;
}

function EmptyState({ title: heading, body }) {
  return <div className="report-empty"><span className="report-empty-icon">▱</span><h3>{heading}</h3><p>{body}</p></div>;
}

function fillSeries(data) {
  const rows = new Map((data.daily || []).map(row => [row._id, row]));
  const start = data.range?.start ? new Date(data.range.start) : new Date();
  const end = data.range?.end ? new Date(data.range.end) : new Date();
  const monthly = data.range?.bucket === 'month';
  const cursor = new Date(start);
  const result = [];
  cursor.setUTCHours(0, 0, 0, 0);
  while (cursor <= end && result.length < 400) {
    const key = monthly ? cursor.toISOString().slice(0, 7) : cursor.toISOString().slice(0, 10);
    const row = rows.get(key) || {};
    result.push({ key, orders: Number(row.orders || 0), revenue: Number(row.revenue || 0) });
    if (monthly) cursor.setUTCMonth(cursor.getUTCMonth() + 1, 1);
    else cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result.length ? result : [{ key: start.toISOString().slice(0, 10), orders: 0, revenue: 0 }];
}

function curvedPath(points) {
  if (!points.length) return '';
  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index];
    const middle = (previous.x + point.x) / 2;
    return `${path} C ${middle} ${previous.y}, ${middle} ${point.y}, ${point.x} ${point.y}`;
  }, `M ${points[0].x} ${points[0].y}`);
}

function OrderTrend({ data }) {
  const series = useMemo(() => fillSeries(data), [data]);
  const max = Math.max(1, ...series.map(point => point.orders));
  const points = series.map((point, index) => ({ ...point, x: series.length === 1 ? 500 : index / (series.length - 1) * 1000, y: 220 - point.orders / max * 210 }));
  const line = curvedPath(points);
  const area = `${line} L ${points.at(-1).x} 220 L ${points[0].x} 220 Z`;
  const tickStep = Math.max(1, Math.ceil(series.length / 18));
  const yTicks = [max, max * .75, max * .5, max * .25, 0];
  return <section className="report-panel report-volume-panel">
    <h3><Icon name="revenue"/> Order Volume &amp; Revenue</h3>
    <div className="report-chart">
      <div className="report-chart-y">{yTicks.map((value, index) => <span key={index}>{Number(value.toFixed(2))}</span>)}</div>
      <div className="report-chart-plot">
        {[0, 1, 2, 3, 4].map(index => <i style={{ top: `${index * 25}%` }} key={index}/>)}
        <svg viewBox="0 0 1000 220" preserveAspectRatio="none" role="img" aria-label="Orders over the selected period">
          <defs><linearGradient id="reportArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5b079b" stopOpacity=".14"/><stop offset="1" stopColor="#5b079b" stopOpacity="0"/></linearGradient></defs>
          <path className="report-chart-area" d={area}/><path className="report-chart-line" d={line}/>
          {points.filter(point => point.orders > 0).map(point => <circle cx={point.x} cy={point.y} r="3.5" key={point.key}><title>{point.key}: {point.orders} orders, {money(point.revenue)}</title></circle>)}
        </svg>
        <div className="report-chart-x">{series.map((point, index) => index % tickStep === 0 || index === series.length - 1 ? <span style={{ left: `${series.length === 1 ? 50 : index / (series.length - 1) * 100}%` }} key={point.key}>{point.key}</span> : null)}</div>
      </div>
    </div>
    <div className="report-chart-legend"><i/> Orders</div>
  </section>;
}

function StatusMix({ data }) {
  const statuses = [...coreStatuses, ...optionalStatuses.filter(status => Number(data.statusMix?.[status] || 0) > 0)];
  return <section className="report-panel report-status-panel"><h3>Status Mix</h3><div className="report-status-grid">{statuses.map(status => <div key={status}><span>{status}</span><b>{number(data.statusMix?.[status])}</b></div>)}</div></section>;
}

function HubVisibility({ data }) {
  return <section className="report-panel report-hubs-panel"><h3>Cross-Hub Visibility</h3>{data.hubs?.length ? <div className="report-hub-list">{data.hubs.map(hub => <div key={hub._id || hub.hubId}><span><b>{hub.name}</b> <small>({hub.code || hub.hubId})</small></span><strong>{number(hub.orders)} orders | {hub.hitRate}% hit</strong></div>)}</div> : <EmptyState title="No hubs in scope" body="Authorized hub records will appear here."/>}</section>;
}

function SettlementRecords({ records = [], heading = 'Merchant Referral / COD Settlement Records' }) {
  return <section className="report-panel report-records-panel"><h3>{heading}</h3>{records.length ? <div className="report-table-wrap"><div className="report-record-head"><span>Reference</span><span>Merchant</span><span>Type</span><span>Status</span><span>Recorded</span><span>Amount</span></div>{records.map(record => <div className="report-record-row" key={`${record.type}-${record.id}`}><span><b>{record.reference}</b></span><span>{record.merchant}</span><span>{record.type}</span><span><em className={`report-status-pill ${String(record.status).toLowerCase()}`}>{title(record.status)}</em></span><span>{dateTime(record.recordedAt)}</span><span><b>{money(record.amount)}</b></span></div>)}</div> : <EmptyState title="No merchant settlement history" body="No merchant payout or COD settlement records were returned for this period."/>}</section>;
}

function Overview({ data }) {
  return <><Scope data={data}/><div className="report-metrics five">
    <Metric label="Total Orders" value={number(data.totalOrders)} note="Backend order count for period" tone="purple" icon="orders"/>
    <Metric label="Revenue" value={money(data.revenue)} note="Delivered delivery fees only" tone="green" icon="revenue"/>
    <Metric label="Avg Delivery Time" value={`${number(data.avgDeliveryMinutes)} min`} note="Pickup to delivered" tone="violet" icon="time"/>
    <Metric label="Avg Rider Rating" value={`${number(data.averageRiderRating)}/5`} note={`${number(data.riderCount)} riders in scope`} tone="orange" icon="rating"/>
    <Metric label="Failed Rate" value={`${number(data.failedRate)}%`} note={`${number(data.failedOrders)} failed orders`} tone="red" icon="failed"/>
  </div><OrderTrend data={data}/><div className="report-two"><StatusMix data={data}/><HubVisibility data={data}/></div><SettlementRecords records={data.cod?.records}/></>;
}

function Drivers({ data }) {
  const riders = data.riders || [];
  const online = riders.filter(rider => rider.availability && rider.availability !== 'OFFLINE').length;
  const deliveries = riders.reduce((sum, rider) => sum + Number(rider.periodDeliveries || 0), 0);
  return <><Scope data={data}/><div className="report-metrics four"><Metric label="Riders In Scope" value={number(riders.length)} note="Authorized driver profiles" tone="purple" icon="riders"/><Metric label="Online Riders" value={number(online)} note="Current availability state" tone="green" icon="riders"/><Metric label="Period Deliveries" value={number(deliveries)} note="Delivered in selected period" tone="violet" icon="orders"/><Metric label="Average Rating" value={`${number(data.averageRiderRating)}/5`} note="Current rider ratings" tone="orange" icon="rating"/></div><section className="report-panel report-board"><h3>Driver Performance</h3>{riders.length ? <div className="report-table-wrap"><div className="report-driver-head"><span>#</span><span>Driver</span><span>Status</span><span>Orders</span><span>Delivered</span><span>Completion</span><span>Avg Time</span><span>Rating</span><span>COD Held</span></div>{riders.map((rider,index)=><div className="report-driver-row" key={rider._id}><span>{index+1}</span><span><b>{rider.name}</b><small>{rider.driverCode || 'No driver code'}</small></span><span><em className={`report-status-pill ${String(rider.availability).toLowerCase()}`}>{title(rider.availability)}</em></span><span>{number(rider.periodOrders)}</span><span>{number(rider.periodDeliveries)}</span><span>{rider.completionRate}%</span><span>{number(rider.avgDeliveryMinutes)} min</span><span>{number(rider.rating)}/5</span><span><b>{money(rider.codHeld)}</b></span></div>)}</div> : <EmptyState title="No riders in scope" body="Driver performance will appear after rider profiles are created."/>}</section></>;
}

function Cod({ data }) {
  const cod = data.cod || {};
  return <><Scope data={data}/><div className="report-metrics four"><Metric label="Order COD" value={money(cod.total)} note="All COD records for period" tone="orange" icon="cod"/><Metric label="COD In Field" value={money(cod.inField)} note="Pending and collected COD" tone="purple" icon="cod"/><Metric label="COD Settled" value={money(cod.settled)} note="Reconciled merchant payouts" tone="green" icon="revenue"/><Metric label="Pending Withdrawals" value={money(cod.pendingWithdrawals)} note="Unprocessed payout requests" tone="red" icon="failed"/></div><SettlementRecords records={cod.records} heading="COD Reconciliation & Merchant Payouts"/></>;
}

function Zones({ data }) {
  const zones = data.zones || [];
  const active = zones.filter(zone => zone.status === 'ACTIVE').length;
  const mappedOrders = zones.reduce((sum, zone) => sum + Number(zone.orders || 0), 0);
  const best = [...zones].sort((a,b) => b.successRate - a.successRate || b.orders - a.orders)[0];
  const average = zones.length ? zones.reduce((sum, zone) => sum + Number(zone.successRate || 0), 0) / zones.length : 0;
  return <><Scope data={data}/><div className="report-metrics four"><Metric label="Active Zones" value={number(active)} note={`${number(zones.length)} configured zones`} tone="purple" icon="zones"/><Metric label="Mapped Orders" value={number(mappedOrders)} note="Orders with an assigned zone" tone="violet" icon="orders"/><Metric label="Top Zone" value={best?.name || '—'} note={best ? `${best.successRate}% delivery success` : 'No zone activity'} tone="green" icon="revenue"/><Metric label="Avg Success" value={`${Number(average.toFixed(1))}%`} note="Across configured zones" tone="orange" icon="rating"/></div><section className="report-panel report-zone-panel"><h3>Zone Delivery Performance</h3>{zones.length ? <div className="report-zone-list">{zones.map(zone=><article key={zone._id}><header><span><b>{zone.name}</b><small>{zone.code || zone.hubId}</small></span><strong>{zone.successRate}%</strong></header><div><i style={{width:`${Math.min(100,Math.max(0,zone.successRate))}%`}}/></div><footer><span>{number(zone.orders)} orders</span><span>{number(zone.delivered)} delivered</span><span>{number(zone.failed)} failed</span><span>{money(zone.revenue)} revenue</span></footer></article>)}</div> : <EmptyState title="No delivery zones configured" body="Zone metrics will appear after zones are added to an authorized hub."/>}</section></>;
}

function Customers({ data }) {
  const customers = data.customers || {};
  const records = customers.records || [];
  const repeatRate = customers.unique ? Number((customers.repeat / customers.unique * 100).toFixed(1)) : 0;
  return <><Scope data={data}/><div className="report-metrics four"><Metric label="Unique Customers" value={number(customers.unique)} note="Unique phone numbers in period" icon="customers"/><Metric label="Repeat Customers" value={`${repeatRate}%`} note={`${number(customers.repeat)} repeat customers`} tone="green" icon="customers"/><Metric label="Avg Orders / Customer" value={number(customers.averageOrders)} note="Orders in selected period" tone="purple" icon="orders"/><Metric label="Failed Customer Orders" value={number(customers.failedOrders)} note="Failed order records" tone="red" icon="failed"/></div><section className="report-panel report-board"><h3>Customer Order Activity</h3>{records.length ? <div className="report-table-wrap"><div className="report-customer-head"><span>Customer</span><span>Phone</span><span>Orders</span><span>Delivered</span><span>Failed</span><span>COD Value</span><span>Last Order</span></div>{records.map(record=><div className="report-customer-row" key={record._id}><span><b>{record.name || 'Customer'}</b></span><span>{record._id || 'Not supplied'}</span><span>{number(record.orders)}</span><span>{number(record.delivered)}</span><span>{number(record.failed)}</span><span><b>{money(record.codValue)}</b></span><span>{dateTime(record.lastOrderAt)}</span></div>)}</div> : <EmptyState title="No customer activity" body="Customer order activity will appear for the selected period."/>}</section></>;
}

export function ReportsPage() {
  const [tab,setTab] = useState('Overview');
  const [period,setPeriod] = useState('MONTHLY');
  const [exporting,setExporting] = useState(false);
  const [exportError,setExportError] = useState('');
  const loader = useCallback(signal => reportService.get(signal,{period}),[period]);
  const {data = {},loading,error} = useApiQuery(loader,{});
  async function exportCsv(){setExporting(true);setExportError('');try{await reportService.export('csv',{period});}catch(requestError){setExportError(requestError.response?.data?.message||'Report export failed.');}finally{setExporting(false);}}
  return <div className="reports-page">
    <div className="reports-controls"><div role="tablist" aria-label="Report sections">{tabs.map(name=><button role="tab" aria-selected={tab===name} className={tab===name?'active':''} onClick={()=>setTab(name)} key={name}>{name}</button>)}</div><div className="report-actions"><label><span className="sr-only">Reporting period</span><select value={period} onChange={event=>setPeriod(event.target.value)}>{periods.map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label><button className="export-report" disabled={exporting} onClick={exportCsv}><span aria-hidden="true">⇩</span>{exporting?'Exporting…':'Export'}</button></div></div>
    <main className={`reports-content${loading?' is-loading':''}`}>{(error||exportError)&&<div className="warning-note" role="alert">{error||exportError}</div>}{tab==='Overview'&&<Overview data={data}/>} {tab==='Driver Performance'&&<Drivers data={data}/>} {tab==='COD Reconciliation'&&<Cod data={data}/>} {tab==='Zone Heatmap'&&<Zones data={data}/>} {tab==='Customer Reports'&&<Customers data={data}/>}</main>
  </div>;
}
