import { useCallback } from 'react';
import { LiveRiders, RecentOrders } from '../../components/dashboard/Activity';
import { OverviewCards, PerformanceCards } from '../../components/dashboard/DashboardCards';
import { DeliveryTrend, WeeklyDeliveries, ZoneDistribution } from '../../components/dashboard/Charts';
import { Card } from '../../components/ui/Card';
import { useApiQuery } from '../../hooks/useApiQuery';
import { hubManagerService } from '../../services/resource.service';

const money = value => `UGX ${Number(value || 0).toLocaleString()}`;

function HubSignals({ alerts = 0 }) {
  return alerts ? <div className="alert"><span className="alert-icon">!</span><div><b>{alerts} dashboard signal{alerts===1?'':'s'} need attention</b><p>Review failed deliveries, driver availability, and COD exposure.</p></div></div> : <div className="hub-clear-banner"><span>✓</span><div><b>All dashboard signals are clear</b><p>Live data for the assigned hub is within the configured thresholds.</p></div></div>;
}

function HubStats({ data }) {
  const metrics=data.metrics||{};
  const response=data.performance?.avgDriverResponseMinutes;
  const values=[
    ['Deliveries today',metrics.deliveredOrders||0,`${metrics.todayOrders||0} total orders`,'purple'],
    ['Online riders',metrics.onlineDrivers||0,`${metrics.totalDrivers||0} total drivers`,'green'],
    ['Avg response',response?`${response} min`:'No data','Driver acceptance speed','teal'],
    ['COD in field',money(metrics.codInField),`${metrics.codOrders||0} active COD orders`,'orange'],
    ['Failed deliveries',metrics.failedOrders||0,`${Number(data.performance?.failedDeliveryRate||0)}% failure rate`,'red'],
  ];
  return <div className="stats-grid">{values.map(([label,value,detail,tone])=><Card className="stat-card" key={label}><div className={`stat-icon ${tone}`}>•</div><span className="eyebrow">{label}</span><strong>{value}</strong><p>{detail}</p></Card>)}</div>;
}

function TargetProgress({ data }) {
  const metrics=data.metrics||{};
  const hit=Math.min(100,Number(metrics.targetHitRate||0));
  return <Card className="hub-target-progress"><div><span className="eyebrow">Assigned hub performance</span><h2>{data.scope?.hubName||'Assigned hub'}</h2><p>{data.scope?.hubCode||data.scope?.hubId} · operational data is isolated to this hub.</p></div><div className="hub-target-meter"><b>{hit}%</b><span>{metrics.deliveredOrders||0} of {metrics.dailyTarget||0} daily target</span><i><u style={{width:`${hit}%`}}/></i></div></Card>;
}

export function HubManagerDashboard() {
  const loader=useCallback(signal=>hubManagerService.dashboard(signal),[]);
  const {data,loading,error}=useApiQuery(loader,{});
  if(loading&&!data.scope)return <div className="empty-state"><p>Loading assigned hub dashboard…</p></div>;
  return <>
    {error&&<div className="warning-note" role="alert">{error}</div>}
    <HubSignals alerts={data.activeAlerts}/>
    <HubStats data={data}/>
    <TargetProgress data={data}/>
    <OverviewCards data={data}/>
    <div className="trend-grid"><DeliveryTrend data={data.deliveryTrend}/><ZoneDistribution data={data.zoneDistribution}/></div>
    <div className="activity-grid"><RecentOrders orders={data.recentOrders}/><LiveRiders riders={data.liveRiders}/></div>
    <PerformanceCards performance={data.performance}/>
    <WeeklyDeliveries data={data.weeklyDeliveries}/>
  </>;
}
