import { useCallback } from 'react';
import { useApiQuery } from '../../hooks/useApiQuery';
import { hubManagerService } from '../../services/resource.service';

const money=value=>`UGX ${Number(value||0).toLocaleString()}`;

function Metric({label,value,note,tone='purple'}){return <div className="hub-metric"><div><span>{label}</span><b className={`hub-metric-value hub-tone-${tone}`}>{value}</b><small>{note}</small></div><i className={`hub-metric-icon hub-tone-${tone}`}>•</i></div>}

export function AssignedHubPage(){
  const loader=useCallback(signal=>hubManagerService.context(signal),[]);
  const{data,loading,error}=useApiQuery(loader,{hub:null,metrics:{}});
  if(loading&&!data.hub)return <div className="empty-state">Loading assigned hub…</div>;
  const hub=data.hub;
  if(!hub)return <div className="warning-note">{error||'Assigned hub could not be loaded.'}</div>;
  const metrics=data.metrics||{};
  const zone=hub.zoneCoverage?.join(', ')||'Not set';
  const location=hub.address||[hub.city,hub.region].filter(Boolean).join(', ');
  return <div className="hub-management-page assigned-hub-page">
    <div className="hub-page-heading"><div><h1>Assigned Hub - Local Manager View</h1><p>Only your assigned hub details are visible here.</p></div></div>
    {error&&<div className="warning-note">{error}</div>}
    <div className="hub-network-metrics"><Metric label="Assigned Hub" value="1" note={metrics.active?'1 active':'Inactive'}/><Metric label="Hub Manager" value="1" note="Local manager profile" tone="violet"/><Metric label="Hub Orders" value={metrics.orders||0} note="Assigned hub only" tone="green"/><Metric label="Hub Revenue" value={money(metrics.revenue)} note="Assigned hub only" tone="orange"/><Metric label="Hub Active State" value={metrics.active?'100%':'0%'} note="Assigned hub status" tone="green"/></div>
    <section className="hub-manager-isolation-banner"><b>Hub manager data isolation active</b><p>External hub order lists, customer contacts, courier directories, exact addresses, and branch operations are hidden. Every operational request is scoped by your authenticated hub assignment.</p><span>Shield</span></section>
    <section className="selected-hub"><div className="selected-hub-title"><div><span>Selected Hub</span><h2>{hub.name}</h2><p>{location}</p></div><em className="hub-active">{metrics.active?'Active':'Inactive'}</em></div><div className="selected-hub-facts">{[['Code',hub.code||hub.hubId],['City',hub.city],['Zone',zone],['Manager','Assigned'],['Phone',hub.phone],['Email',hub.email]].map(([label,value])=><div key={label}><span>{label}</span><b title={value}>{value||'Not set'}</b></div>)}</div></section>
    <div className="hq-hub-grid assigned-hub-grid"><article className="hq-hub-card selected"><div className="hq-card-title"><i>◇</i><div><h3>{hub.name}</h3><p>{hub.code||hub.hubId} · {hub.city}</p></div><span>{metrics.active?'Active':'Inactive'}</span></div><p className="hub-contact">Pin &nbsp; {location}</p><div className="hub-card-stats"><p><b>{metrics.orders||0}</b><span>Orders</span></p><p><b className="purple">{metrics.drivers||0}</b><span>Drivers</span></p><p><b className="orange">{metrics.merchants||0}</b><span>Merchants</span></p></div><div className="hub-revenue"><span>{money(metrics.revenue)} revenue</span><span>Contact set</span></div><footer><button type="button">Eye &nbsp; View</button></footer></article></div>
    <section className="hub-isolation"><div><span>Hub-Level Access Isolation</span><h3>This account is limited to its assigned hub</h3></div><b>Shield</b><main><p><b>Hub records</b><span>Only assigned hub visible</span></p><p><b>Manager assignment</b><span>Restricted</span></p><p><b>Suspend/reactivate</b><span>HQ admin only</span></p></main></section>
  </div>;
}
