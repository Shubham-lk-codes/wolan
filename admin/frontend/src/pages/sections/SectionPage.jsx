import { Link } from '../../router/Router';

export function SectionPage({ item }) {
  return <div className="section-page">
    <div className="section-icon">{item.icon}</div>
    <h2>{item.label}</h2>
    <p>This route is ready for the {item.label.toLowerCase()} module.</p>
    <Link to="/">Return to dashboard</Link>
  </div>;
}
