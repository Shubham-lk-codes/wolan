const items = [
  ['onlineDrivers', 'Online drivers', '●', 'green'],
  ['activeDeliveries', 'Active deliveries', '◆', 'purple'],
  ['delayedRiders', 'Delayed riders', '!', 'red'],
  ['pendingOrders', 'Pending orders', '○', 'orange'],
];

export function LiveMapStats({ stats = {} }) {
  return <section className="live-map-stats" aria-label="Live delivery statistics">
    {items.map(([key, label, icon, tone]) => <article className={`live-map-stat ${tone}`} key={key}>
      <span className="live-map-stat-icon" aria-hidden="true">{icon}</span>
      <div><strong>{stats[key] ?? 0}</strong><span>{label}</span></div>
    </article>)}
  </section>;
}
