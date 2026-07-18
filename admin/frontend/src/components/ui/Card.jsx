export function Card({ className = '', children }) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function CardHeading({ title, subtitle, action }) {
  return <div className="card-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>;
}
