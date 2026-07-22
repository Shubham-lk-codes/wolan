import { Card, CardHeading } from '../ui/Card';

const hours = ['12am', '3am', '6am', '9am', '12pm', '3pm', '6pm', '9pm'];
const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function EmptyChart({ weekly = false }) {
  const labels = weekly ? days : hours;
  return <div className={`chart ${weekly ? 'weekly' : ''}`}>
    <div className="y-axis"><span>4</span><span>3</span><span>2</span><span>1</span><span>0</span></div>
    <div className="plot"><i /><i /><i /><i /><i />
      <div className="x-axis">{labels.map(x => <span key={x}>{x}</span>)}</div>
    </div>
  </div>;
}

function Bars({ rows, valueKey, labelKey = 'label' }) {
  const max = Math.max(1, ...rows.map(row => Number(row[valueKey] || 0)));
  return <div className="backend-bars">{rows.map(row => <div key={row[labelKey]}><i style={{height:`${Math.max(3, Number(row[valueKey] || 0) / max * 100)}%`}}/><span>{row[labelKey]}</span></div>)}</div>;
}

export function DeliveryTrend({ data = [] }) {
  return <Card><CardHeading title="Delivery Trend" subtitle="Order volume over time from backend data" action={<span className="legend purple">Orders</span>} />{data.length ? <Bars rows={data} valueKey="orders"/> : <EmptyChart />}</Card>;
}

export function ZoneDistribution({ data = [] }) {
  const total = data.reduce((sum, row) => sum + Number(row.orders || 0), 0);
  return <Card><CardHeading title="Zone Distribution" subtitle="Orders by delivery zone" />{data.length ? <div className="zone-distribution-list">{data.map(row=><div key={row.zoneId}><span>{row.zoneId}</span><i><u style={{width:`${total?row.orders/total*100:0}%`}}/></i><b>{row.orders}</b></div>)}</div> : <div className="zone-empty">No zone data yet.</div>}</Card>;
}

export function WeeklyDeliveries({ data = [] }) {
  const rows=data.map(row=>({...row,label:new Date(`${row.date}T00:00:00`).toLocaleDateString([],{weekday:'short'})}));
  return <Card className="weekly-card"><CardHeading title="Weekly Deliveries" subtitle="Completed vs failed by day" action={<div className="legend-group"><span className="legend green">Completed</span><span className="legend red">Failed</span></div>} />{rows.length?<div className="weekly-backend-bars">{rows.map(row=><div key={row.date}><main><i style={{height:`${Math.max(2,row.completed*10)}%`}}/><u style={{height:`${Math.max(2,row.failed*10)}%`}}/></main><span>{row.label}</span></div>)}</div>:<EmptyChart weekly />}</Card>;
}
