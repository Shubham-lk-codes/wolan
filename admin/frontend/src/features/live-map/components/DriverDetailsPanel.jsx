import { formatTime, statusLabel, timeAgo } from '../liveMap.utils';

function Coordinate({ location }) {
  return <span>{location ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}` : 'Waiting for GPS'}</span>;
}

export function DriverDetailsPanel({ driver, onClose }) {
  if (!driver) return <aside className="driver-map-details empty">
    <div className="details-empty-icon">⌖</div>
    <h3>Select a driver</h3>
    <p>Choose a rider marker to inspect the driver, package, delivery state, destination, and ETA.</p>
  </aside>;
  const order = driver.currentOrder;
  return <aside className="driver-map-details">
    <header>
      <div className={`driver-detail-avatar ${driver.delayed ? 'delayed' : ''}`}>{driver.name?.split(/\s+/).map((part) => part[0]).join('').slice(0, 2)}</div>
      <div><span>{driver.driverCode}</span><h3>{driver.name}</h3><p>{driver.hubName}</p></div>
      <button type="button" onClick={onClose} aria-label="Close driver details">×</button>
    </header>
    <div className="driver-detail-badges">
      <span className={`driver-state ${driver.displayStatus?.toLowerCase()}`}>{statusLabel(driver.displayStatus)}</span>
      {driver.idle && <span className="driver-state idle">Idle {driver.stationaryMinutes}m</span>}
      <span className="gps-age">GPS {timeAgo(driver.lastHeartbeatAt)}</span>
    </div>
    <dl className="driver-facts">
      <div><dt>Phone</dt><dd>{driver.phone}</dd></div>
      <div><dt>Vehicle</dt><dd>{driver.plateNumber}</dd></div>
      <div><dt>Rating</dt><dd>{Number(driver.rating || 0).toFixed(1)} / 5</dd></div>
      <div><dt>Rider location</dt><dd><Coordinate location={driver.location} /></dd></div>
    </dl>
    {order ? <section className="driver-current-order">
      <div className="detail-section-heading"><span>Current order</span><b>{order.orderNumber}</b></div>
      <div className="delivery-status-line"><span>{statusLabel(order.status)}</span><b className={driver.delayed ? 'late' : ''}>{driver.delayed ? 'Delayed' : 'On schedule'}</b></div>
      <div className="destination-card"><small>Destination</small><strong>{order.destination}</strong><Coordinate location={order.destinationLocation} /></div>
      <div className="eta-row"><div><span>ETA</span><b>{order.etaMinutes ? `${order.etaMinutes} min` : formatTime(order.etaAt)}</b></div><div><span>Expected at</span><b>{formatTime(order.etaAt)}</b></div></div>
      <div className="tracker-locations">
        <div><i className="rider-location-dot"/><span>Rider location</span><Coordinate location={driver.location} /></div>
        <div><i className="package-location-dot"/><span>Package location</span><Coordinate location={order.packageLocation} /></div>
      </div>
      {order.mismatch && <div className="mismatch-warning"><b>Package–Rider Mismatch</b><span>{order.separationMetres ? `${order.separationMetres.toLocaleString()} m separation detected` : 'Tracker positions do not match'}</span></div>}
    </section> : <section className="no-current-order"><b>No active delivery</b><p>This driver is not currently assigned to an in-progress order.</p></section>}
  </aside>;
}
