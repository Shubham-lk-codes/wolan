import { useCallback, useEffect, useMemo, useState } from 'react';
import { DriverDetailsPanel } from './components/DriverDetailsPanel';
import { LiveMapCanvas } from './components/LiveMapCanvas';
import { LiveMapStats } from './components/LiveMapStats';
import { useLiveMap } from './hooks/useLiveMap';
import { STATUS_FILTERS, statusLabel, timeAgo } from './liveMap.utils';

export function LiveMapFeature() {
  const { snapshot, loading, error, realtimeConnected, refresh } = useLiveMap();
  const [status, setStatus] = useState('ALL');
  const [hubId, setHubId] = useState('ALL');
  const [selectedDriverId, setSelectedDriverId] = useState(null);
  const [mapType, setMapType] = useState('ROADMAP');
  const [showZones, setShowZones] = useState(true);
  const [showPackages, setShowPackages] = useState(true);

  const hubDrivers = useMemo(() => (snapshot?.drivers ?? []).filter((driver) => hubId === 'ALL' || driver.hubId === hubId), [hubId, snapshot?.drivers]);
  const visibleDrivers = useMemo(() => hubDrivers.filter((driver) => status === 'ALL' || driver.displayStatus === status), [hubDrivers, status]);
  const visibleZones = useMemo(() => (snapshot?.zones ?? []).filter((zone) => hubId === 'ALL' || zone.hubId === hubId), [hubId, snapshot?.zones]);
  const selectedDriver = (snapshot?.drivers ?? []).find((driver) => driver.id === selectedDriverId) ?? null;
  const storedStats = hubId === 'ALL' ? snapshot?.stats : snapshot?.statsByHub?.[hubId];
  const stats = useMemo(() => ({
    ...storedStats,
    onlineDrivers: hubDrivers.filter((driver) => driver.availability !== 'OFFLINE').length,
    activeDeliveries: hubDrivers.filter((driver) => Boolean(driver.currentOrder)).length,
    delayedRiders: hubDrivers.filter((driver) => driver.delayed).length,
  }), [hubDrivers, storedStats]);
  const mismatchCount = hubDrivers.filter((driver) => driver.currentOrder?.mismatch).length;
  const selectDriver = useCallback((id) => setSelectedDriverId(id), []);

  useEffect(() => {
    if (selectedDriverId && !visibleDrivers.some((driver) => driver.id === selectedDriverId)) setSelectedDriverId(null);
  }, [selectedDriverId, visibleDrivers]);

  if (loading && !snapshot) return <div className="live-map-loading"><span/><h2>Preparing live operations map</h2><p>Loading scoped drivers, deliveries, packages, and zones…</p></div>;

  return <div className="live-map-page">
    <section className="map-page-heading">
      <div><span className="map-eyebrow">Operations control</span><h2>Live delivery map</h2><p>{snapshot?.access?.mode === 'HQ' ? 'All authorized hubs' : `${snapshot?.hubs?.[0]?.name || snapshot?.access?.hubId || 'Assigned hub'} only`} · Updated {timeAgo(snapshot?.generatedAt)}</p></div>
      <div className={`realtime-state ${realtimeConnected ? 'connected' : ''}`}><i/><span><b>{realtimeConnected ? 'Live updates connected' : 'Reconnecting live updates'}</b><small>Location changes stream automatically</small></span><button type="button" onClick={() => refresh()} aria-label="Refresh map data">↻</button></div>
    </section>
    {error && <div className="live-map-error"><b>Map data could not be refreshed.</b><span>{error}</span><button type="button" onClick={() => refresh()}>Try again</button></div>}
    <LiveMapStats stats={stats}/>
    <section className="live-map-controls">
      <div className="driver-status-filters" aria-label="Filter drivers by status">
        {STATUS_FILTERS.map(([value, label]) => <button type="button" className={status === value ? 'active' : ''} onClick={() => setStatus(value)} key={value}>{label}<span>{value === 'ALL' ? hubDrivers.length : hubDrivers.filter((driver) => driver.displayStatus === value).length}</span></button>)}
      </div>
      <div className="map-scope-controls">
        {(snapshot?.hubs?.length ?? 0) > 1 && <label>Hub<select value={hubId} onChange={(event) => setHubId(event.target.value)}><option value="ALL">All hubs</option>{snapshot.hubs.map((hub) => <option value={hub.id} key={hub.id}>{hub.name}</option>)}</select></label>}
        <label>Map style<select value={mapType} onChange={(event) => setMapType(event.target.value)}><option value="ROADMAP">Default</option><option value="SATELLITE">Satellite</option><option value="TERRAIN">Terrain</option></select></label>
        <button type="button" className={showZones ? 'active' : ''} onClick={() => setShowZones((value) => !value)}>Zones</button>
        <button type="button" className={showPackages ? 'active' : ''} onClick={() => setShowPackages((value) => !value)}>Packages</button>
      </div>
    </section>
    {mismatchCount > 0 && <div className="map-alert-strip"><span>!</span><div><b>{mismatchCount} Package–Rider Mismatch alert{mismatchCount === 1 ? '' : 's'}</b><p>Package and rider trackers are more than 500 m apart.</p></div><button type="button" onClick={() => { const driver = hubDrivers.find((item) => item.currentOrder?.mismatch); if (driver) setSelectedDriverId(driver.id); }}>Review alert</button></div>}
    <main className="live-map-workspace">
      <section className="map-panel">
        <div className="map-panel-title"><div><b>{visibleDrivers.filter((driver) => driver.location).length}</b><span>drivers visible</span></div><p>{status === 'ALL' ? 'All driver states' : statusLabel(status)} · {visibleZones.length} delivery zones</p></div>
        <LiveMapCanvas drivers={visibleDrivers} zones={visibleZones} selectedDriverId={selectedDriverId} onSelect={selectDriver} mapType={mapType} showZones={showZones} showPackages={showPackages}/>
        {!visibleDrivers.length && <div className="map-empty-result"><b>No drivers match this filter</b><span>Choose another status or hub to restore markers.</span></div>}
      </section>
      <DriverDetailsPanel driver={selectedDriver} onClose={() => setSelectedDriverId(null)}/>
    </main>
  </div>;
}
