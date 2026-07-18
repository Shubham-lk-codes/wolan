import { AlertBanner, OverviewCards, PerformanceCards, StatCards } from '../../components/dashboard/DashboardCards';
import { DeliveryTrend, WeeklyDeliveries, ZoneDistribution } from '../../components/dashboard/Charts';
import { LiveRiders, RecentOrders } from '../../components/dashboard/Activity';
import { useCallback } from 'react';
import { useApiQuery } from '../../hooks/useApiQuery';
import { dashboardService } from '../../services/resource.service';

export function DashboardPage() {
  const loader = useCallback(signal => dashboardService.get(signal), []);
  const { data } = useApiQuery(loader, {});
  return <>
    <AlertBanner data={data} />
    <StatCards data={data} />
    <OverviewCards data={data} />
    <div className="trend-grid"><DeliveryTrend /><ZoneDistribution /></div>
    <div className="activity-grid"><RecentOrders orders={data.recentOrders} /><LiveRiders riders={data.liveRiders} /></div>
    <PerformanceCards />
    <WeeklyDeliveries />
  </>;
}
