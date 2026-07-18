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

export function DeliveryTrend() {
  return <Card><CardHeading title="Delivery Trend" subtitle="Order volume over time from backend data" action={<span className="legend purple">Orders</span>} /><EmptyChart /></Card>;
}

export function ZoneDistribution() {
  return <Card><CardHeading title="Zone Distribution" subtitle="Orders by delivery zone" /><div className="zone-empty">No zone data yet.</div></Card>;
}

export function WeeklyDeliveries() {
  return <Card className="weekly-card"><CardHeading title="Weekly Deliveries" subtitle="Completed vs failed by day" action={<div className="legend-group"><span className="legend green">Completed</span><span className="legend red">Failed</span></div>} /><EmptyChart weekly /></Card>;
}
